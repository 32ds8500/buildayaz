/**
 * Adaptive Retry Middleware
 * Exponential backoff with jitter and provider-aware retry decisions
 */

import type { LLMProvider } from '../types';
import { healthTracker } from './health';
import type { AdaptiveRetryConfig, RetryDecision } from './types';

const DEFAULT_CONFIG: AdaptiveRetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitterMs: 500,
  maxRetries: 3,
  backoffMultiplier: 2,
  providerAware: true,
};

class AdaptiveRetryManager {
  private config: AdaptiveRetryConfig;

  constructor(config: Partial<AdaptiveRetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  shouldRetry(
    error: unknown,
    attempt: number,
    provider: LLMProvider,
    model?: string,
  ): RetryDecision {
    // Check retry limit
    if (attempt >= this.config.maxRetries) {
      return {
        shouldRetry: false,
        delayMs: 0,
        nextAttempt: attempt + 1,
        reason: 'Max retries exceeded',
      };
    }

    // Check error retryability
    const llmErr = error instanceof Error ? error : null;
    const hasRetryableFlag = llmErr && 'retryable' in llmErr;
    const isRetryable = !hasRetryableFlag || (llmErr as Record<string, unknown>).retryable !== false;

    if (!isRetryable) {
      return {
        shouldRetry: false,
        delayMs: 0,
        nextAttempt: attempt + 1,
        reason: 'Non-retryable error',
      };
    }

    // Get provider health
    const health = healthTracker.getDetailedHealth(provider, model);
    const delayMs = this.calculateBackoff(attempt, health.recommendedBackoff);

    return {
      shouldRetry: true,
      delayMs,
      nextAttempt: attempt + 1,
      reason: `Retry ${attempt + 1}/${this.config.maxRetries}`,
    };
  }

  private calculateBackoff(attempt: number, providerBackoff: number): number {
    // Exponential backoff
    const exponential =
      this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);

    // Add jitter
    const withJitter = exponential + Math.random() * this.config.jitterMs;

    // Apply provider-aware adjustment
    let adjusted = withJitter;
    if (this.config.providerAware && providerBackoff > 0) {
      adjusted = Math.max(withJitter, providerBackoff);
    }

    // Cap at max
    return Math.min(adjusted, this.config.maxDelayMs);
  }

  async waitBeforeRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Retry aborted'));
        return;
      }

      const timeout = setTimeout(resolve, delayMs);

      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('Retry aborted'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export const adaptiveRetryManager = new AdaptiveRetryManager();
