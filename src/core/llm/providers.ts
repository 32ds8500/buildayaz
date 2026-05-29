/**
 * Provider Registry — central hub for all LLM providers
 * Handles: registration, routing, fallbacks, circuit breaking, retries
 */
import type {
  ILLMProvider, LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk,
  ModelInfo, ProviderCapabilities, ProviderHealth, RetryConfig, LLMConfig,
} from './types';
import { LLMError, DEFAULT_RETRY_CONFIG } from './types';
import { GeminiProvider } from './providers/gemini';
import { PollinationsProvider } from './providers/pollinations';
import { GroqProvider } from './providers/groq';
import { OpenRouterProvider } from './providers/openrouter';
import { TogetherProvider } from './providers/together';
import { HuggingFaceProvider } from './providers/huggingface';
import { OllamaProvider } from './providers/ollama';
import { OpenAIProvider, CustomProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { circuitBreaker } from './middleware/circuitBreaker';
import { withRetry } from './middleware/retry';
import { withTimeout } from './middleware/timeout';
import { logger } from './logging/logger';

const log = logger.forModule('Registry');

// ─── Singleton instances ──────────────────────────────────────────

const REGISTRY = new Map<LLMProvider, ILLMProvider>([
  ['gemini',      new GeminiProvider()],
  ['pollinations',new PollinationsProvider()],
  ['groq',        new GroqProvider()],
  ['openrouter',  new OpenRouterProvider()],
  ['together',    new TogetherProvider()],
  ['huggingface', new HuggingFaceProvider()],
  ['ollama',      new OllamaProvider()],
  ['openai',      new OpenAIProvider()],
  ['anthropic',   new AnthropicProvider()],
  ['custom',      new CustomProvider()],
]);

// ─── Default fallback chain (free-first) ─────────────────────────

const FREE_FALLBACK_CHAIN: LLMProvider[] = [
  'pollinations',  // no key, always works
  'gemini',        // free with key
  'groq',          // free with key
  'openrouter',    // free models with key
  'together',      // free models with key
  'huggingface',   // free with key
  'ollama',        // local
];

// ─── Public API ───────────────────────────────────────────────────

export function getProvider(provider: LLMProvider): ILLMProvider {
  return REGISTRY.get(provider) ?? REGISTRY.get('pollinations')!;
}

export function getAllProviders(): Array<{
  id: LLMProvider;
  name: string;
  displayName: string;
  models: ModelInfo[];
  capabilities: ProviderCapabilities;
  isFreeProvider: boolean;
}> {
  return [...REGISTRY.entries()].map(([id, p]) => ({
    id,
    name: id,
    displayName: p.displayName,
    models: p.getModels(),
    capabilities: p.capabilities,
    isFreeProvider: p.capabilities.freeAccess,
  }));
}

export function getFreeProviders() {
  return getAllProviders().filter(p => p.isFreeProvider);
}

export function getAllModels(): ModelInfo[] {
  return [...REGISTRY.values()].flatMap(p => p.getModels());
}

export function getFreeModels(): ModelInfo[] {
  return getAllModels().filter(m => m.isFree);
}

export function getModelInfo(provider: LLMProvider, modelId: string): ModelInfo | undefined {
  return getProvider(provider).getModels().find(m => m.id === modelId);
}

export function getModelsForCapability(cap: keyof ProviderCapabilities): ModelInfo[] {
  return [...REGISTRY.entries()]
    .filter(([, p]) => p.capabilities[cap])
    .flatMap(([, p]) => p.getModels());
}

export function getProviderHealth(): ProviderHealth[] {
  return [...REGISTRY.keys()].map(id => circuitBreaker.getHealth(id));
}

// ─── Resilient chat with circuit breaker + retry + timeout ────────

const REQUEST_TIMEOUT_MS = 60_000;

export async function resilientChat(
  request: LLMRequest,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<LLMResponse> {
  const { provider } = request.config;

  if (circuitBreaker.isOpen(provider)) {
    throw new LLMError({ code: 'CIRCUIT_OPEN', message: `Provider ${provider} geçici olarak devre dışı`, provider, retryable: false });
  }

  const t0 = performance.now();
  try {
    const result = await withRetry(
      () => withTimeout(
        () => getProvider(provider).chat(request),
        REQUEST_TIMEOUT_MS,
        `${provider}/chat`,
      ),
      retryConfig,
      request.signal,
      `${provider}/chat`,
    );
    circuitBreaker.recordSuccess(provider, Math.round(performance.now() - t0));
    log.debug('Chat success', { model: request.config.model, ms: Math.round(performance.now() - t0) });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    circuitBreaker.recordFailure(provider, msg);
    log.warn('Chat failed', { error: msg });
    throw err;
  }
}

// ─── Resilient stream with circuit breaker ─────────────────────────

export async function* resilientStream(
  request: LLMRequest,
): AsyncGenerator<LLMStreamChunk> {
  const { provider } = request.config;

  if (circuitBreaker.isOpen(provider)) {
    yield { type: 'error', error: `Provider ${provider} geçici olarak devre dışı` };
    return;
  }

  const t0 = performance.now();
  try {
    yield* getProvider(provider).stream(request);
    circuitBreaker.recordSuccess(provider, Math.round(performance.now() - t0));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    circuitBreaker.recordFailure(provider, msg);
    log.warn('Stream failed', { error: msg });
    yield { type: 'error', error: msg };
  }
}

// ─── Fallback orchestration ────────────────────────────────────────

export async function chatWithFallback(
  request: LLMRequest,
  fallbackChain?: LLMProvider[],
): Promise<LLMResponse & { usedFallback?: LLMProvider }> {
  const chain = fallbackChain ?? FREE_FALLBACK_CHAIN;
  const primary = request.config.provider;

  // Try primary first
  try {
    const result = await resilientChat(request);
    return result;
  } catch (err) {
    log.warn('Primary failed, trying fallbacks', { error: err instanceof Error ? err.message : String(err) });
  }

  // Try fallback chain
  for (const fallbackProvider of chain) {
    if (fallbackProvider === primary) continue;
    if (circuitBreaker.isOpen(fallbackProvider)) continue;

    const fallbackProvider_ = getProvider(fallbackProvider);
    // Use provider's default model
    const defaultModel = fallbackProvider_.getModels()[0]?.id;
    if (!defaultModel) continue;

    const fallbackConfig: LLMConfig = {
      ...request.config,
      provider: fallbackProvider,
      model: defaultModel,
      apiKey: request.config.apiKey || '',
    };

    // Skip if key required and not provided
    if (fallbackProvider_.capabilities.requiresApiKey && !fallbackConfig.apiKey && fallbackProvider !== 'pollinations' && fallbackProvider !== 'ollama') continue;

    try {
      log.info(`Fallback attempt with model ${defaultModel}`);
      const result = await resilientChat({ ...request, config: fallbackConfig });
      return { ...result, usedFallback: fallbackProvider };
    } catch { /* try next */ }
  }

  throw new LLMError({ code: 'ALL_PROVIDERS_FAILED', message: 'Tüm provider\'lar başarısız oldu', provider: primary, retryable: false });
}

export async function* streamWithFallback(
  request: LLMRequest,
  fallbackChain?: LLMProvider[],
): AsyncGenerator<LLMStreamChunk & { usedFallback?: LLMProvider }> {
  const chain = fallbackChain ?? FREE_FALLBACK_CHAIN;
  const primary = request.config.provider;

  if (!circuitBreaker.isOpen(primary)) {
    let hasOutput = false;
    try {
      for await (const chunk of resilientStream(request)) {
        hasOutput = true;
        yield chunk;
        if (chunk.type === 'done') return;
        if (chunk.type === 'error' && !hasOutput) break;
      }
      if (hasOutput) return;
    } catch { /* fall through to fallback */ }
  }

  // Fallback: use non-streaming chat and simulate stream
  for (const fallbackProvider of chain) {
    if (fallbackProvider === primary) continue;
    if (circuitBreaker.isOpen(fallbackProvider)) continue;

    const p = getProvider(fallbackProvider);
    const defaultModel = p.getModels()[0]?.id;
    if (!defaultModel) continue;
    if (p.capabilities.requiresApiKey && !request.config.apiKey && fallbackProvider !== 'pollinations' && fallbackProvider !== 'ollama') continue;

    try {
      log.info(`Stream fallback to ${defaultModel}`);
      const fallbackReq = { ...request, config: { ...request.config, provider: fallbackProvider, model: defaultModel } };
      for await (const chunk of resilientStream(fallbackReq)) {
        yield { ...chunk, usedFallback: fallbackProvider };
        if (chunk.type === 'done') return;
      }
      return;
    } catch { /* try next */ }
  }

  yield { type: 'error', error: 'Tüm providerlar başarısız' };
}

// ─── Backwards-compat exports ─────────────────────────────────────

export { withRetry };
export type { RetryConfig };

// SSE helper re-export
export { parseSSE } from './utils/sse';
export type { LLMProvider, ModelInfo, ProviderCapabilities, ProviderHealth, LLMConfig };
