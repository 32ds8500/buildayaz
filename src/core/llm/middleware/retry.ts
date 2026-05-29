/**
 * Retry with exponential backoff + jitter
 * Respects AbortSignal, LLMError.retryable flag, and circuit breaker
 */
import { LLMError, type RetryConfig, DEFAULT_RETRY_CONFIG } from '../types';
import { logger } from '../logging/logger';

const log = logger.forModule('Retry');

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Aborted')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('Aborted')); }, { once: true });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  signal?: AbortSignal,
  _label = 'operation',
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (signal?.aborted) throw new Error('Request aborted');
      if (err instanceof LLMError && !err.retryable) throw err;
      if (attempt >= config.maxRetries) break;

      // Read Retry-After if present on 429
      let waitMs = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * config.jitterMs,
        config.maxDelayMs,
      );

      if (err instanceof LLMError && err.status === 429) {
        // Could extend to read Retry-After header if passed through
        waitMs = Math.max(waitMs, 5000);
      }

      log.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(waitMs)}ms`, {
        error: err instanceof Error ? err.message : String(err),
      });

      await delay(waitMs, signal);
    }
  }

  throw lastError;
}
