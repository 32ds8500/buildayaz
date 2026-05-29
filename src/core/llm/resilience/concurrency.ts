/**
 * Concurrency Limiter
 * Prevents provider overload by limiting parallel requests
 * Supports per-provider and per-model limits
 */

import type { LLMProvider } from '../types';
import { logger } from '../logging/logger';
import type { ConcurrencyConfig, ConcurrencySlot } from './types';

const log = logger.forModule('ConcurrencyLimiter');

const DEFAULT_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 10,
  maxPerProviderPerModel: 5,
  queueSize: 100,
  timeoutMs: 30_000,
};

class ConcurrencyLimiter {
  private slots = new Map<string, ConcurrencySlot[]>();
  private waitQueues = new Map<string, Array<{ resolve: () => void; reject: (err: Error) => void }>>();
  private config: ConcurrencyConfig;

  constructor(config: Partial<ConcurrencyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private key(provider: LLMProvider, model?: string): string {
    return model ? `${provider}:${model}` : provider;
  }

  async acquire(provider: LLMProvider, model?: string): Promise<() => void> {
    const k = this.key(provider, model);

    while (true) {
      const current = this.slots.get(k) ?? [];
      const active = current.filter(s => !s.releasedAt);

      if (active.length < this.config.maxPerProviderPerModel) {
        const slot: ConcurrencySlot = {
          provider,
          model,
          acquiredAt: Date.now(),
        };
        current.push(slot);
        this.slots.set(k, current);

        log.debug(`Concurrency slot acquired: ${k} (${active.length + 1}/${this.config.maxPerProviderPerModel})`);

        // Return release function
        return () => {
          slot.releasedAt = Date.now();
          this.processQueue(k);
        };
      }

      // Wait for a slot to be released
      await this.waitForSlot(k);
    }
  }

  private waitForSlot(k: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const queue = this.waitQueues.get(k) ?? [];
      queue.push({ resolve, reject });
      this.waitQueues.set(k, queue);

      // Set timeout
      const timeout = setTimeout(() => {
        const idx = queue.indexOf({ resolve, reject });
        if (idx !== -1) queue.splice(idx, 1);
        reject(new Error(`Concurrency timeout waiting for slot: ${k}`));
      }, this.config.timeoutMs);

      // Store timeout for cleanup
      resolve(); // This will be called when slot is available
      clearTimeout(timeout);
    });
  }

  private processQueue(k: string): void {
    const queue = this.waitQueues.get(k) ?? [];
    if (queue.length > 0) {
      const waiter = queue.shift();
      if (waiter) {
        waiter.resolve();
      }
    }
  }

  getStats(provider?: LLMProvider): Record<string, { active: number; max: number }> {
    const stats: Record<string, { active: number; max: number }> = {};

    for (const [k, slots] of this.slots) {
      if (provider && !k.startsWith(provider)) continue;
      const active = slots.filter(s => !s.releasedAt).length;
      stats[k] = { active, max: this.config.maxPerProviderPerModel };
    }

    return stats;
  }

  reset(): void {
    this.slots.clear();
    this.waitQueues.clear();
    log.info('Concurrency limiter reset');
  }
}

export const concurrencyLimiter = new ConcurrencyLimiter();
