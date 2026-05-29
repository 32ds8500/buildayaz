/**
 * HuggingFace Inference API — Free tier (rate limited)
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { streamSSE } from '../utils/sse';

const FREE_MODELS: ModelInfo[] = [
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct',
    provider: 'huggingface', contextWindow: 32768, maxOutputTokens: 2048,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'microsoft/Phi-3-mini-4k-instruct',
    name: 'Phi-3 Mini 4K',
    provider: 'huggingface', contextWindow: 4096, maxOutputTokens: 2048,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
  {
    id: 'HuggingFaceH4/zephyr-7b-beta',
    name: 'Zephyr 7B Beta',
    provider: 'huggingface', contextWindow: 32768, maxOutputTokens: 2048,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'free', isFree: true,
  },
];

export class HuggingFaceProvider implements ILLMProvider {
  readonly name = 'huggingface' as const;
  readonly displayName = 'HuggingFace Inference (Free)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: false, vision: false, jsonMode: false, reasoning: false,
    imageGeneration: false, embeddings: true, freeAccess: true, requiresApiKey: true, localOnly: false,
  };

  private buildMessages(request: LLMRequest) {
    return request.messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user', content: m.content }));
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const model = request.config.model || 'mistralai/Mistral-7B-Instruct-v0.3';
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${request.config.apiKey}` },
      body: JSON.stringify({ model, messages: this.buildMessages(request), max_tokens: request.config.maxTokens ?? 1024, temperature: request.config.temperature ?? 0.7 }),
      signal: request.signal,
    });
    if (!res.ok) throw LLMError.fromHttpStatus(res.status, await res.text(), this.name);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 },
      model, provider: 'huggingface',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const model = request.config.model || 'mistralai/Mistral-7B-Instruct-v0.3';
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${request.config.apiKey}` },
      body: JSON.stringify({ model, messages: this.buildMessages(request), max_tokens: request.config.maxTokens ?? 1024, temperature: request.config.temperature ?? 0.7, stream: true }),
      signal: request.signal,
    });
    if (!res.ok) { yield { type: 'error', error: LLMError.fromHttpStatus(res.status, await res.text(), this.name).message }; return; }
    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No stream' }; return; }
    for await (const data of streamSSE(reader, request.signal)) {
      if (data === '[DONE]') { yield { type: 'done' }; return; }
      try { const p = JSON.parse(data); const c = p.choices?.[0]?.delta?.content; if (c) yield { type: 'text', content: c }; } catch { /* skip */ }
    }
    yield { type: 'done' };
  }

  getModels(): ModelInfo[] { return FREE_MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'HuggingFace token gerekli (ücretsiz: huggingface.co/settings/tokens)', provider: this.name, retryable: false };
    return null;
  }
}
