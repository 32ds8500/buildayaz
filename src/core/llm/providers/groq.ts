/**
 * Groq Provider — Ultra-fast inference, free tier available
 * Free: 14,400 req/day on most models
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { BaseAdapter } from './adapters/base';

const FREE_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    contextWindow: 128000,
    maxOutputTokens: 32768,
    supportsTools: true,
    supportsVision: false,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Llama 3.3 70B on Groq — free tier',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Ultra-fast 8B model on Groq',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    contextWindow: 32768,
    maxOutputTokens: 32768,
    supportsTools: true,
    supportsVision: false,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Mixtral MoE on Groq',
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'groq',
    contextWindow: 8192,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Google Gemma 2 9B on Groq',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    provider: 'groq',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'DeepSeek R1 reasoning distilled on Groq',
  },
];

export class GroqProvider extends BaseAdapter implements ILLMProvider {
  protected readonly providerName = 'groq';
  readonly name = 'groq' as const;
  readonly displayName = 'Groq (Free Tier)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: true, vision: false, jsonMode: true, reasoning: true,
    imageGeneration: false, embeddings: false, freeAccess: true, requiresApiKey: true, localOnly: false,
  };

  private buildHeaders(apiKey: string) {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  }

  private buildBody(request: LLMRequest, stream: boolean) {
    return {
      model: request.config.model || 'llama-3.3-70b-versatile',
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.config.temperature ?? 0.7,
      max_tokens: request.config.maxTokens ?? 4096,
      stream,
    };
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      provider: 'groq',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'Groq API anahtarı gerekli (ücretsiz: console.groq.com)', provider: this.name, retryable: false };
    return null;
  }
}
