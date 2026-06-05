/**
 * OpenAI Provider — paid, kept for compatibility
 * Also handles custom OpenAI-compatible endpoints (LM Studio, vLLM, etc.)
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { BaseAdapter } from './adapters/base';

const MODELS: ModelInfo[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, tier: 'standard', isFree: false },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, costPer1kInput: 0.0025, costPer1kOutput: 0.01, tier: 'premium', isFree: false },
];

export class OpenAIProvider extends BaseAdapter implements ILLMProvider {
  protected readonly providerName = 'openai';
  readonly name = 'openai' as const;
  readonly displayName = 'OpenAI';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: true, vision: true, jsonMode: true, reasoning: false,
    imageGeneration: false, embeddings: true, freeAccess: false, requiresApiKey: true, localOnly: false,
  };

  protected getBaseUrl(config: LLMConfig): string {
    return config.baseUrl || 'https://api.openai.com/v1';
  }

  protected buildHeaders(config: LLMConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
  }

  protected buildBody(request: LLMRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.config.model,
      messages: request.messages.map(m => ({ role: m.role, content: m.content, ...(m.name && { name: m.name }), ...(m.toolCallId && { tool_call_id: m.toolCallId }), ...(m.toolCalls && { tool_calls: m.toolCalls }) })),
      temperature: request.config.temperature ?? 0.7,
      stream,
    };
    if (request.config.maxTokens) body.max_tokens = request.config.maxTokens;
    if (request.tools?.length) body.tools = request.tools;
    if (stream) body.stream_options = { include_usage: true };
    return body;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const res = await fetch(`${this.getBaseUrl(request.config)}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(request.config),
      body: JSON.stringify(this.buildBody(request, false)),
      signal: request.signal,
    });
    if (!res.ok) throw this.buildError(res.status, await res.text());
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      toolCalls: data.choices?.[0]?.message?.tool_calls,
      usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 },
      model: data.model, provider: 'openai',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const res = await fetch(`${this.getBaseUrl(request.config)}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(request.config),
      body: JSON.stringify(this.buildBody(request, true)),
      signal: request.signal,
    });
    if (!res.ok) { yield { type: 'error', error: this.buildError(res.status, await res.text()).message }; return; }
    yield* this.readOpenAIStream(request, res);
  }

  getModels(): ModelInfo[] { return MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'OpenAI API anahtarı gerekli', provider: this.name, retryable: false };
    return null;
  }
}

export class CustomProvider extends OpenAIProvider {
  readonly name = 'custom' as const;
  readonly displayName = 'Custom OpenAI-Compatible';
  override readonly capabilities = { ...super.capabilities, freeAccess: true };

  override getModels(): ModelInfo[] { return []; }

  override validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.baseUrl) return { code: 'NO_BASE_URL', message: 'Custom provider için baseUrl gerekli', provider: this.name, retryable: false };
    return null;
  }
}
