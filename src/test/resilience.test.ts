/**
 * Resilience Infrastructure Tests
 * Validates health scoring, concurrency, streams, backpressure, and cancellation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { healthTracker } from '@core/llm/resilience/health';
import { concurrencyLimiter } from '@core/llm/resilience/concurrency';
import { streamRecoveryManager } from '@core/llm/resilience/streamRecovery';
import { backpressureManager, RequestPriority } from '@core/llm/resilience/backpressure';
import { adaptiveRetryManager } from '@core/llm/resilience/adaptiveRetry';
import { cancellationManager } from '@core/llm/resilience/cancellation';
import type { LLMProvider } from '@core/llm/types';

describe('Resilience Infrastructure', () => {
  describe('Health Tracker', () => {
    beforeEach(() => {
      healthTracker.reset();
    });

    it('should initialize with score of 100', () => {
      const score = healthTracker.getHealthScore('openai');
      expect(score).toBe(100);
    });

    it('should decrease score on failures', () => {
      for (let i = 0; i < 3; i++) {
        healthTracker.recordFailure('openai', 'API Error');
      }
      const score = healthTracker.getHealthScore('openai');
      expect(score).toBeLessThan(100);
    });

    it('should track detailed health metrics', () => {
      healthTracker.recordSuccess('openai', 500);
      healthTracker.recordSuccess('openai', 600);
      healthTracker.recordFailure('openai', 'timeout');

      const health = healthTracker.getDetailedHealth('openai');
      expect(health.status).toBe('healthy');
      expect(health.failureRate).toBeGreaterThan(0);
      expect(health.avgLatencyMs).toBeGreaterThan(0);
    });

    it('should compute health score based on latency and failure rate', () => {
      // Good: fast + no failures
      healthTracker.recordSuccess('openai' as LLMProvider, 100);
      healthTracker.recordSuccess('openai' as LLMProvider, 150);

      // Bad: slow + failures
      for (let i = 0; i < 5; i++) {
        healthTracker.recordFailure('anthropic' as LLMProvider, 'error');
      }

      const goodScore = healthTracker.getHealthScore('openai' as LLMProvider);
      const badScore = healthTracker.getHealthScore('anthropic' as LLMProvider);

      expect(goodScore).toBeGreaterThan(badScore);
    });
  });

  describe('Concurrency Limiter', () => {
    beforeEach(() => {
      concurrencyLimiter.reset();
    });

    it('should allow concurrent requests up to limit', async () => {
      const release1 = await concurrencyLimiter.acquire('openai');
      const release2 = await concurrencyLimiter.acquire('openai');
      const release3 = await concurrencyLimiter.acquire('openai');

      expect(concurrencyLimiter.getStats()['openai']).toEqual({
        active: 3,
        max: 5,
      });

      release1();
      release2();
      release3();
    });

    it('should track per-provider limits', async () => {
      const r1 = await concurrencyLimiter.acquire('openai' as LLMProvider);
      const r2 = await concurrencyLimiter.acquire('anthropic' as LLMProvider);

      const stats = concurrencyLimiter.getStats();
      expect(stats['openai'].active).toBe(1);
      expect(stats['anthropic'].active).toBe(1);

      r1();
      r2();
    });
  });

  describe('Stream Recovery', () => {
    beforeEach(() => {
      streamRecoveryManager.reset();
    });

    it('should track stream state', () => {
      const streamId = 'stream-1';
      streamRecoveryManager.initializeStream(streamId);

      const state = streamRecoveryManager.getState(streamId);
      expect(state?.started).toBe(true);
      expect(state?.chunkCount).toBe(0);
    });

    it('should record interruptions and allow retries', () => {
      const streamId = 'stream-2';
      streamRecoveryManager.initializeStream(streamId);

      streamRecoveryManager.markInterrupted(streamId);
      expect(streamRecoveryManager.canRetry(streamId)).toBe(true);

      for (let i = 0; i < 3; i++) {
        streamRecoveryManager.markInterrupted(streamId);
      }

      expect(streamRecoveryManager.canRetry(streamId)).toBe(false);
    });

    it('should calculate exponential backoff for retries', () => {
      const streamId = 'stream-3';
      streamRecoveryManager.initializeStream(streamId);

      streamRecoveryManager.markInterrupted(streamId);
      const delay1 = streamRecoveryManager.getRetryDelay(streamId);

      streamRecoveryManager.markInterrupted(streamId);
      const delay2 = streamRecoveryManager.getRetryDelay(streamId);

      expect(delay2).toBeGreaterThanOrEqual(delay1);
    });
  });

  describe('Backpressure Manager', () => {
    beforeEach(() => {
      backpressureManager.reset();
    });

    it('should enqueue requests by priority', async () => {
      await backpressureManager.enqueue({
        id: '1',
        provider: 'openai' as LLMProvider,
        model: 'gpt-4',
        priority: RequestPriority.LOW,
        createdAt: Date.now(),
        enqueueTime: Date.now(),
      });

      await backpressureManager.enqueue({
        id: '2',
        provider: 'openai' as LLMProvider,
        model: 'gpt-4',
        priority: RequestPriority.HIGH,
        createdAt: Date.now(),
        enqueueTime: Date.now(),
      });

      const dequeued1 = backpressureManager.dequeue();
      expect(dequeued1?.id).toBe('2'); // HIGH priority first
    });

    it('should report queue stats', async () => {
      await backpressureManager.enqueue({
        id: '1',
        provider: 'openai' as LLMProvider,
        model: 'gpt-4',
        priority: RequestPriority.NORMAL,
        createdAt: Date.now(),
        enqueueTime: Date.now(),
      });

      const stats = backpressureManager.getStats();
      expect(stats.queueSize).toBe(1);
      expect(stats.processedCount).toBe(0);
    });
  });

  describe('Adaptive Retry Manager', () => {
    it('should calculate exponential backoff', async () => {
      const decision = adaptiveRetryManager.shouldRetry(
        new Error('Rate limited'),
        0,
        'openai' as LLMProvider,
      );

      expect(decision.shouldRetry).toBe(true);
      expect(decision.delayMs).toBeGreaterThan(0);
    });

    it('should respect max retries limit', () => {
      const decision = adaptiveRetryManager.shouldRetry(
        new Error('Error'),
        3, // at max
        'openai' as LLMProvider,
      );

      expect(decision.shouldRetry).toBe(false);
    });
  });

  describe('Cancellation Manager', () => {
    it('should create abort contexts', () => {
      const ctx = cancellationManager.createContext(5000);
      expect(ctx.signal).toBeInstanceOf(AbortSignal);
      expect(ctx.controller).toBeInstanceOf(AbortController);
    });

    it('should support cancellable operations', async () => {
      const id = 'op-1';
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('done'), 100);
      });

      const op = cancellationManager.cancellable(id, promise, 5000);
      const result = await op.promise;

      expect(result).toBe('done');
    });

    it('should cancel operations', async () => {
      const id = 'op-2';
      const promise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 5000);
      });

      const op = cancellationManager.cancellable(id, promise, 10000);

      setTimeout(() => {
        op.cancel('test cancellation');
      }, 100);

      await expect(op.promise).rejects.toThrow('cancelled');
    });

    it('should chain multiple abort signals', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const chained = cancellationManager.chainSignals(
        controller1.signal,
        controller2.signal,
      );

      expect(chained.aborted).toBe(false);

      controller1.abort();
      expect(chained.aborted).toBe(true);
    });
  });
});
