/**
 * Ollama Provider — Local inference, completely free, no API key
 * Requires Ollama running locally on http://localhost:11434
 */
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig, ModelInfo, ProviderCapabilities, LLMErrorShape } from '../types';

const DEFAULT_BASE = 'http://localhost:11434';

// Common local models (user must pull these themselves)
const COMMON_MODELS: ModelInfo[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2 3B (Local)',
    provider: 'ollama', contextWindow: 128000, maxOutputTokens: 4096,
    supportsTools: false, supportsVision: false, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Requires: ollama pull llama3.2',
  },
  {
    id: 'llama3.1',
    name: 'Llama 3.1 8B (Local)',
    provider: 'ollama', contextWindow: 128000, maxOutputTokens: 4096,
    supportsTools: true, supportsVision: false, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Requires: ollama pull llama3.1',
  },
  {
    id: 'mistral',
    name: 'Mistral 7B (Local)',
    provider: 'ollama', contextWindow: 32768, maxOutputTokens: 4096,
    supportsTools: true, supportsVision: false, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Requires: ollama pull mistral',
  },
  {
    id: 'gemma2',
    name: 'Gemma 2 9B (Local)',
    provider: 'ollama', contextWindow: 8192, maxOutputTokens: 4096,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Requires: ollama pull gemma2',
  },
  {
    id: 'qwen2.5-coder',
    name: 'Qwen2.5 Coder 7B (Local)',
    provider: 'ollama', contextWindow: 32768, maxOutputTokens: 4096,
    supportsTools: true, supportsVision: false, supportsJsonMode: true, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Code-optimized local model. Requires: ollama pull qwen2.5-coder',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 7B (Local)',
    provider: 'ollama', contextWindow: 128000, maxOutputTokens: 4096,
    supportsTools: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: true,
    costPer1kInput: 0, costPer1kOutput: 0, tier: 'local', isFree: true,
    description: 'Reasoning model. Requires: ollama pull deepseek-r1',
  },
];

export class OllamaProvider implements ILLMProvider {
  readonly name = 'ollama' as const;
  readonly displayName = 'Ollama (Local, Free)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true, tools: false, vision: false, jsonMode: true, reasoning: true,
    imageGeneration: false, embeddings: true, freeAccess: true, requiresApiKey: false, localOnly: true,
  };

  private baseUrl(config: LLMConfig): string {
    return config.baseUrl || DEFAULT_BASE;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    const base = this.baseUrl(request.config);
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.config.model || 'llama3.1',
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature: request.config.temperature ?? 0.7, num_predict: request.config.maxTokens ?? 2048 },
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 0 || !res.status) throw new Error('Ollama bağlanamadı. Çalışıyor mu? (ollama serve)');
      throw new Error(`Ollama hatası: ${body}`);
    }

    const data = await res.json();
    return {
      content: data.message?.content || '',
      usage: { promptTokens: data.prompt_eval_count || 0, completionTokens: data.eval_count || 0, totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0) },
      model: data.model || request.config.model,
      provider: 'ollama',
      finishReason: data.done_reason || 'stop',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const base = this.baseUrl(request.config);
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.config.model || 'llama3.1',
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        options: { temperature: request.config.temperature ?? 0.7, num_predict: request.config.maxTokens ?? 2048 },
      }),
      signal: request.signal,
    });

    if (!res.ok) { yield { type: 'error', error: 'Ollama bağlantı hatası' }; return; }

    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No stream' }; return; }

    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        if (request.signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.message?.content) yield { type: 'text', content: ev.message.content };
            if (ev.done) {
              yield { type: 'usage', usage: { promptTokens: ev.prompt_eval_count || 0, completionTokens: ev.eval_count || 0, totalTokens: (ev.prompt_eval_count || 0) + (ev.eval_count || 0) } };
              yield { type: 'done' };
              return;
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    yield { type: 'done' };
  }

  async healthCheck(config: LLMConfig): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl(config)}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch { return false; }
  }

  async listLocalModels(config: LLMConfig): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl(config)}/api/tags`);
      const data = await res.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch { return []; }
  }

  getModels(): ModelInfo[] { return COMMON_MODELS; }

  validateConfig(_config: LLMConfig): LLMErrorShape | null {
    return null; // No key needed, runtime check via healthCheck
  }
}
