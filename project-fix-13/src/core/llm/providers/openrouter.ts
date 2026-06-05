/**
 * OpenRouter Provider — Routes to many models, has free models
 * Free models: many via :free suffix or zero-cost models
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { BaseAdapter } from './adapters/base';

const FREE_MODELS: ModelInfo[] = [
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Free)',
    provider: 'openrouter', contextWindow: 1_048_576, maxOutputTokens: 8192,
    supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    provider: 'openrouter', contextWindow: 131072, maxOutputTokens: 8192,
    supportsTools: true, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'openrouter', contextWindow: 128000, maxOutputTokens: 8192,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
    description: 'DeepSeek R1 reasoning model — free via OpenRouter',
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3 (Free)',
    provider: 'openrouter', contextWindow: 128000, maxOutputTokens: 8192,
    supportsTools: true, supportsVision: false, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B (Free)',
    provider: 'openrouter', contextWindow: 32768, maxOutputTokens: 4096,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen3 235B (Free)',
    provider: 'openrouter', contextWindow: 40000, maxOutputTokens: 8192,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'microsoft/phi-4-reasoning-plus:free',
    name: 'Phi-4 Reasoning Plus (Free)',
    provider: 'openrouter', contextWindow: 16384, maxOutputTokens: 8192,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
];

export class OpenRouterProvider extends BaseAdapter implements ILLMProvider {
  protected readonly providerName = 'openrouter';
  readonly name = 'openrouter' as const;
  readonly displayName = 'OpenRouter (Free Models)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: true, vision: true, jsonMode: true, reasoning: true,
    imageGeneration: false, embeddings: false, freeAccess: true, requiresApiKey: true, localOnly: false,
  };

  private buildHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': typeof globalThis.location !== 'undefined' ? globalThis.location.href : 'https://kodyap.app',
      'X-Title': 'KodYap IDE',
    };
  }

  private buildBody(request: LLMRequest, stream: boolean) {
    return {
      model: request.config.model || 'google/gemini-2.0-flash-exp:free',
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.config.temperature ?? 0.7,
      max_tokens: request.config.maxTokens ?? 4096,
      stream,
    };
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: this.buildHeaders(request.config.apiKey),
      body: JSON.stringify(this.buildBody(request, false)),
      signal: request.signal,
    });
    if (!res.ok) throw this.buildError(res.status, await res.text());
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 },
      model: data.model || request.config.model,
      provider: 'openrouter',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: this.buildHeaders(request.config.apiKey),
      body: JSON.stringify(this.buildBody(request, true)),
      signal: request.signal,
    });
    if (!res.ok) { yield { type: 'error', error: this.buildError(res.status, await res.text()).message }; return; }
    yield* this.readOpenAIStream(request, res);
  }

  getModels(): ModelInfo[] { return FREE_MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'OpenRouter API anahtarı gerekli (ücretsiz: openrouter.ai)', provider: this.name, retryable: false };
    return null;
  }
}
