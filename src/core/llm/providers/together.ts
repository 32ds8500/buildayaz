/**
 * Together AI Provider — Free tier available
 * Free: $25 credit on signup + free models
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { BaseAdapter } from './adapters/base';

const FREE_MODELS: ModelInfo[] = [
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    name: 'Llama 3.3 70B Turbo (Free)',
    provider: 'together', contextWindow: 131072, maxOutputTokens: 8192,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'meta-llama/Llama-Vision-Free',
    name: 'Llama Vision (Free)',
    provider: 'together', contextWindow: 128000, maxOutputTokens: 4096,
    supportsTools: false, supportsVision: true, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
    name: 'DeepSeek R1 Distill 70B (Free)',
    provider: 'together', contextWindow: 131072, maxOutputTokens: 8192,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
];

export class TogetherProvider extends BaseAdapter implements ILLMProvider {
  protected readonly providerName = 'together';
  readonly name = 'together' as const;
  readonly displayName = 'Together AI (Free Models)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: false, vision: true, jsonMode: false, reasoning: true,
    imageGeneration: false, embeddings: false, freeAccess: true, requiresApiKey: true, localOnly: false,
  };

  private buildHeaders(apiKey: string) {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: this.buildHeaders(request.config.apiKey),
      body: JSON.stringify({
        model: request.config.model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: request.config.maxTokens ?? 4096,
        temperature: request.config.temperature ?? 0.7,
        stream: false,
      }),
      signal: request.signal,
    });
    if (!res.ok) throw this.buildError(res.status, await res.text());
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 },
      model: data.model || request.config.model,
      provider: 'together',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: this.buildHeaders(request.config.apiKey),
      body: JSON.stringify({
        model: request.config.model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: request.config.maxTokens ?? 4096,
        temperature: request.config.temperature ?? 0.7,
        stream: true,
      }),
      signal: request.signal,
    });
    if (!res.ok) { yield { type: 'error', error: this.buildError(res.status, await res.text()).message }; return; }
    yield* this.readOpenAIStream(request, res);
  }

  getModels(): ModelInfo[] { return FREE_MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'Together AI API anahtarı gerekli (ücretsiz: together.ai)', provider: this.name, retryable: false };
    return null;
  }
}
