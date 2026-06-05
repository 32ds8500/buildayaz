/**
 * Pollinations AI Provider — COMPLETELY FREE, NO API KEY
 * Text: OpenAI-compatible endpoint
 * Image: Direct generation endpoint
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { streamSSE } from '../utils/sse';

const MODELS: ModelInfo[] = [
  {
    id: 'openai',
    name: 'Pollinations GPT-4o',
    provider: 'pollinations',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'GPT-4o via Pollinations — no API key needed',
  },
  {
    id: 'mistral',
    name: 'Pollinations Mistral',
    provider: 'pollinations',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Mistral via Pollinations — no API key needed',
  },
  {
    id: 'llama',
    name: 'Pollinations Llama 3.3 70B',
    provider: 'pollinations',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Llama 3.3 70B via Pollinations — no API key needed',
  },
  {
    id: 'deepseek',
    name: 'Pollinations DeepSeek R1',
    provider: 'pollinations',
    contextWindow: 64000,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'DeepSeek R1 reasoning via Pollinations',
  },
  {
    id: 'qwen',
    name: 'Pollinations Qwen 2.5 72B',
    provider: 'pollinations',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Qwen 2.5 72B via Pollinations',
  },
];

const TEXT_BASE = 'https://text.pollinations.ai/openai';
const IMAGE_BASE = 'https://image.pollinations.ai/prompt';

export class PollinationsProvider implements ILLMProvider {
  readonly name = 'pollinations' as const;
  readonly displayName = 'Pollinations AI (Free, No Key)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    tools: false,
    vision: false,
    jsonMode: false,
    reasoning: false,
    imageGeneration: true,
    embeddings: false,
    freeAccess: true,
    requiresApiKey: false,
    localOnly: false,
  };

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const model = request.config.model || 'openai';

    const res = await fetch(TEXT_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        temperature: request.config.temperature ?? 0.7,
        max_tokens: request.config.maxTokens ?? 2048,
        stream: false,
        seed: Math.floor(Math.random() * 99999),
      }),
      signal: request.signal,
    });

    if (!res.ok) throw LLMError.fromHttpStatus(res.status, await res.text(), this.name);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model,
      provider: 'pollinations',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const model = request.config.model || 'openai';

    const res = await fetch(TEXT_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        temperature: request.config.temperature ?? 0.7,
        max_tokens: request.config.maxTokens ?? 2048,
        stream: true,
        seed: Math.floor(Math.random() * 99999),
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      yield { type: 'error', error: LLMError.fromHttpStatus(res.status, await res.text(), this.name).message };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No stream body' }; return; }

    for await (const data of streamSSE(reader, request.signal)) {
      if (data === '[DONE]') { yield { type: 'done' }; return; }
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield { type: 'text', content };
        if (parsed.choices?.[0]?.finish_reason) yield { type: 'done' };
      } catch { /* skip */ }
    }
    yield { type: 'done' };
  }

  /** Generate an image URL via Pollinations (no key needed) */
  generateImageUrl(prompt: string, options?: { width?: number; height?: number; model?: string }): string {
    const encoded = encodeURIComponent(prompt);
    const w = options?.width ?? 1024;
    const h = options?.height ?? 1024;
    const m = options?.model ?? 'flux';
    return `${IMAGE_BASE}/${encoded}?width=${w}&height=${h}&model=${m}&nologo=true`;
  }

  getModels(): ModelInfo[] { return MODELS; }

  validateConfig(_config: LLMConfig): LLMErrorShape | null {
    return null; // no key required
  }
}
