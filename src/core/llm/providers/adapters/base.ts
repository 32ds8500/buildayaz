/**
 * Base adapter with shared SSE streaming logic
 */
import type { LLMRequest, LLMStreamChunk, LLMErrorShape } from '../../types';
import { LLMError } from '../../types';
import { streamSSE } from '../../utils/sse';

export abstract class BaseAdapter {
  protected abstract readonly providerName: string;

  protected buildError(status: number, body: string): LLMError {
    return LLMError.fromHttpStatus(status, body, this.providerName);
  }

  protected validateError(config: { apiKey: string }, requireKey = true): LLMErrorShape | null {
    if (requireKey && !config.apiKey) {
      return { code: 'NO_API_KEY', message: 'API anahtarı gerekli', provider: this.providerName, retryable: false };
    }
    return null;
  }

  protected async *readOpenAIStream(
    request: LLMRequest,
    res: Response,
  ): AsyncGenerator<LLMStreamChunk> {
    const reader = res.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No response body' }; return; }

    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const data of streamSSE(reader, request.signal)) {
      if (data === '[DONE]') { yield { type: 'done' }; return; }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) yield { type: 'text', content: delta.content };

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (tc.id) toolCallBuffers.set(idx, { id: tc.id, name: tc.function?.name || '', args: '' });
            const buf = toolCallBuffers.get(idx);
            if (buf && tc.function?.arguments) buf.args += tc.function.arguments;
            yield { type: 'tool_call_delta', toolCallDelta: { index: idx, id: tc.id, functionName: tc.function?.name, argumentsDelta: tc.function?.arguments } };
          }
        }

        if (parsed.usage) {
          yield { type: 'usage', usage: { promptTokens: parsed.usage.prompt_tokens || 0, completionTokens: parsed.usage.completion_tokens || 0, totalTokens: parsed.usage.total_tokens || 0, cachedTokens: parsed.usage.prompt_tokens_details?.cached_tokens } };
        }

        if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
          for (const [, buf] of toolCallBuffers) {
            yield { type: 'tool_call', toolCall: { id: buf.id, type: 'function', function: { name: buf.name, arguments: buf.args } } };
          }
        }
      } catch { /* skip malformed SSE */ }
    }
    yield { type: 'done' };
  }
}
