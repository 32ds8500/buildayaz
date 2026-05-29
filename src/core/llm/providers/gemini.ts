/**
 * Google Gemini Provider — FREE MODELS ONLY
 * Free tier: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-flash-8b
 * API key required but free quota available
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';
import { LLMError } from '../types';
import { streamSSE } from '../utils/sse';

const FREE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Fast, capable model — FREE tier',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Lightest free Gemini model',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: '1M context window — FREE tier',
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: 'free',
    isFree: true,
    description: 'Ultra-fast small model — FREE tier',
  },
];

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildContents(request: LLMRequest) {
  return request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

function buildBody(request: LLMRequest): Record<string, unknown> {
  const system = request.messages.find(m => m.role === 'system');
  const body: Record<string, unknown> = { contents: buildContents(request) };
  if (system) body.systemInstruction = { parts: [{ text: system.content }] };
  body.generationConfig = {
    temperature: request.config.temperature ?? 0.7,
    maxOutputTokens: request.config.maxTokens ?? 8192,
  };
  return body;
}

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini' as const;
  readonly displayName = 'Google Gemini (Free)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    tools: true,
    vision: true,
    jsonMode: true,
    reasoning: false,
    imageGeneration: false,
    embeddings: false,
    freeAccess: true,
    requiresApiKey: true,
    localOnly: false,
  };

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const model = request.config.model || 'gemini-2.0-flash';
    const url = `${BASE_URL}/${model}:generateContent?key=${request.config.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(request)),
      signal: request.signal,
    });

    if (!res.ok) throw LLMError.fromHttpStatus(res.status, await res.text(), this.name);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

    return {
      content: text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      model,
      provider: 'gemini',
      finishReason: data.candidates?.[0]?.finishReason || 'STOP',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const model = request.config.model || 'gemini-2.0-flash';
    const url = `${BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${request.config.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(request)),
      signal: request.signal,
    });

    if (!res.ok) {
      yield { type: 'error', error: LLMError.fromHttpStatus(res.status, await res.text(), this.name).message };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No stream body' }; return; }

    for await (const data of streamSSE(reader, request.signal)) {
      try {
        const ev = JSON.parse(data);
        const text = ev.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
        if (text) yield { type: 'text', content: text };
        if (ev.usageMetadata) {
          yield { type: 'usage', usage: { promptTokens: ev.usageMetadata.promptTokenCount || 0, completionTokens: ev.usageMetadata.candidatesTokenCount || 0, totalTokens: ev.usageMetadata.totalTokenCount || 0 } };
        }
        if (ev.candidates?.[0]?.finishReason) yield { type: 'done' };
      } catch { /* skip malformed */ }
    }
    yield { type: 'done' };
  }

  getModels(): ModelInfo[] { return FREE_MODELS; }

  validateConfig(config: LLMConfig): LLMErrorShape | null {
    if (!config.apiKey) return { code: 'NO_API_KEY', message: 'Gemini API anahtarı gerekli (ücretsiz: aistudio.google.com)', provider: this.name, retryable: false };
    return null;
  }
}
