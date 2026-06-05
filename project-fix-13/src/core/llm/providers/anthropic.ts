/**
 * Anthropic Provider — paid, kept for compatibility
 * Free via OpenRouter :free variants recommended instead
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { streamSSE } from '../utils/sse';

const MODELS: ModelInfo[] = [
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, supportsTools: true, supportsVision: false, supportsJsonMode: false, supportsStreaming: true, costPer1kInput: 0.0008, costPer1kOutput: 0.004, tier: 'standard', isFree: false, description: 'Most affordable Claude model' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, maxOutputTokens: 8192, supportsTools: true, supportsVision: true, supportsJsonMode: false, supportsStreaming: true, costPer1kInput: 0.003, costPer1kOutput: 0.015, tier: 'premium', isFree: false },
];

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic' as const;
  readonly displayName = 'Anthropic Claude';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: true, vision: true, jsonMode: false, reasoning: true,
    imageGeneration: false, embeddings: false, freeAccess: false, requiresApiKey: true, localOnly: false,
  };

  private buildHeaders(apiKey: string) {
    return { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  }

  private buildBody(request: LLMRequest, stream: boolean) {
    const system = request.messages.find(m => m.role === 'system');
    const msgs = request.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'tool' ? 'user' as const : m.role as 'user' | 'assistant', content: m.content }));
    const body: Record<string, unknown> = { model: request.config.model, max_tokens: request.config.maxTokens || 4096, messages: msgs, stream };
    if (system) body.system = system.content;
    if (request.config.temperature !== undefined) body.temperature = request.config.temperature;
    if (request.tools?.length) body.tools = request.tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
    return body;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const url = request.config.baseUrl || 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, { method: 'POST', headers: this.buildHeaders(request.config.apiKey), body: JSON.stringify(this.buildBody(request, false)), signal: request.signal });
    if (!res.ok) throw LLMError.fromHttpStatus(res.status, await res.text(), this.name);
    const data = await res.json();
    const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
    return { content: text, usage: { promptTokens: data.usage?.input_tokens || 0, completionTokens: data.usage?.output_tokens || 0, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) }, model: data.model, provider: 'anthropic', finishReason: data.stop_reason || 'end_turn', latencyMs: Math.round(performance.now() - t0) };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const url = request.config.baseUrl || 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, { method: 'POST', headers: this.buildHeaders(request.config.apiKey), body: JSON.stringify(this.buildBody(request, true)), signal: request.signal });
    if (!res.ok) { yield { type: 'error', error: LLMError.fromHttpStatus(res.status, await res.text(), this.name).message }; return; }
    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No stream' }; return; }
    for await (const data of streamSSE(reader, request.signal)) {
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') yield { type: 'text', content: ev.delta.text };
        if (ev.type === 'message_delta' && ev.usage) yield { type: 'usage', usage: { promptTokens: 0, completionTokens: ev.usage.output_tokens || 0, totalTokens: ev.usage.output_tokens || 0 } };
        if (ev.type === 'message_stop') { yield { type: 'done' }; return; }
      } catch { /* skip */ }
    }
    yield { type: 'done' };
  }

  getModels(): ModelInfo[] { return MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'Anthropic API anahtarı gerekli', provider: this.name, retryable: false };
    return null;
  }
}
