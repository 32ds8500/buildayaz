/**
 * Backpressure Handling
 * Manages request queue, slows down submissions when queue is full
 * Prioritizes important requests
 */

import { logger } from '../logging/logger';
import type { BackpressureConfig, RequestQueueItem } from './types';
import { RequestPriority } from './types';

const log = logger.forModule('Backpressure');

const DEFAULT_CONFIG: BackpressureConfig = {
  highWaterMark: 50,
  lowWaterMark: 20,
  pauseTimeoutMs: 5000,
};

interface PriorityQueueNode {
  item: RequestQueueItem;
  priority: number;
  index: number;
}

class BackpressureManager {
  private queue: PriorityQueueNode[] = [];
  private waiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private isPaused = false;
  private config: BackpressureConfig;
  private processedCount = 0;
  private droppedCount = 0;

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async enqueue(
    item: RequestQueueItem,
  ): Promise<RequestQueueItem> {
    // Check for abort signal early
    if (item.signal?.aborted) {
      throw new Error('Request aborted before enqueue');
    }

    // If queue exceeds high water mark, wait for backpressure to ease
    if (this.queue.length >= this.config.highWaterMark) {
      log.warn(`Backpressure: queue size ${this.queue.length}, pausing submissions`);
      this.isPaused = true;

      await this.waitForCapacity();
    }

    // Add to priority queue
    this.insertByPriority(item);

    return item;
  }

  private insertByPriority(item: RequestQueueItem): void {
    const node: PriorityQueueNode = {
      item,
      priority: item.priority,
      index: this.queue.length,
    };

    // Simple insertion: add to end, will be sorted on dequeue
    this.queue.push(node);

    // Keep sorted by priority
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): RequestQueueItem | null {
    if (this.queue.length === 0) return null;

    const node = this.queue.shift();
    if (!node) return null;

    this.processedCount++;

    // Resume if below low water mark
    if (this.isPaused && this.queue.length <= this.config.lowWaterMark) {
      this.isPaused = false;
      log.info(`Backpressure released: queue size ${this.queue.length}`);
      this.notifyWaiters();
    }

    return node.item;
  }

  private waitForCapacity(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waiters.indexOf({ resolve, reject });
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('Backpressure timeout'));
      }, this.config.pauseTimeoutMs);

      this.waiters.push({
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject,
      });
    });
  }

  private notifyWaiters(): void {
    const toNotify = this.waiters.splice(0, 10);
    for (const waiter of toNotify) {
      waiter.resolve();
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueuedByPriority(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const node of this.queue) {
      const p = node.priority.toString();
      result[p] = (result[p] ?? 0) + 1;
    }
    return result;
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      isPaused: this.isPaused,
      processedCount: this.processedCount,
      droppedCount: this.droppedCount,
      waitingCount: this.waiters.length,
    };
  }

  reset(): void {
    this.queue = [];
    this.waiters = [];
    this.isPaused = false;
    this.processedCount = 0;
    this.droppedCount = 0;
    log.info('Backpressure manager reset');
  }
}

export const backpressureManager = new BackpressureManager();

// ─────────────────────── Priority Utilities ───────────────────────

export function resolvePriority(p: number | RequestPriority): number {
  if (typeof p === 'number') return p;
  return p as number;
}

export const PriorityLevels = {
  CRITICAL: 10,
  HIGH: 7,
  NORMAL: 5,
  LOW: 2,
  DEFERRED: 0,
} as const;

// Re-export RequestPriority enum for convenience
export { RequestPriority };
