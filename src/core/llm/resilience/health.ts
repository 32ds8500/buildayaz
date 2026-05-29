/**
 * Provider Health Tracking & Scoring
 * Tracks latency, failure rate, timeouts, and stream interruption
 * Computes health score (0-100) for intelligent provider selection
 */

import type { LLMProvider } from '../types';
import { logger } from '../logging/logger';
import type { DetailedHealth, ProviderMetrics } from './types';

const log = logger.forModule('HealthTracker');

const WINDOW_SIZE = 20;
const LATENCY_WEIGHT = 0.2;
const FAILURE_WEIGHT = 0.4;
const TIMEOUT_WEIGHT = 0.2;
const STREAM_INTERRUPT_WEIGHT = 0.2;

class HealthTracker {
  private metrics = new Map<string, ProviderMetrics>();

  private key(provider: LLMProvider, model?: string): string {
    return model ? `${provider}:${model}` : provider;
  }

  private getOrCreate(provider: LLMProvider, model?: string): ProviderMetrics {
    const k = this.key(provider, model);
    if (!this.metrics.has(k)) {
      this.metrics.set(k, {
        latencies: [],
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        streamInterruptCount: 0,
        lastError: null,
        lastErrorTime: 0,
        circuitState: 'closed',
        healthScore: 100,
      });
    }
    return this.metrics.get(k)!;
  }

  recordSuccess(
    provider: LLMProvider,
    latencyMs: number,
    model?: string,
  ): void {
    const m = this.getOrCreate(provider, model);
    m.latencies.push(latencyMs);
    if (m.latencies.length > WINDOW_SIZE) {
      m.latencies.shift();
    }
    m.successCount++;
    this.updateHealthScore(m);
  }

  recordFailure(
    provider: LLMProvider,
    error: string,
    model?: string,
  ): void {
    const m = this.getOrCreate(provider, model);
    m.failureCount++;
    m.lastError = error;
    m.lastErrorTime = Date.now();
    this.updateHealthScore(m);
  }

  recordTimeout(provider: LLMProvider, model?: string): void {
    const m = this.getOrCreate(provider, model);
    m.timeoutCount++;
    m.lastError = 'TIMEOUT';
    m.lastErrorTime = Date.now();
    this.updateHealthScore(m);
  }

  recordStreamInterrupt(provider: LLMProvider, model?: string): void {
    const m = this.getOrCreate(provider, model);
    m.streamInterruptCount++;
    this.updateHealthScore(m);
  }

  private updateHealthScore(m: ProviderMetrics): void {
    const total = m.successCount + m.failureCount;
    if (total === 0) {
      m.healthScore = 100;
      return;
    }

    const failureRate = m.failureCount / total;
    const timeoutRate = m.timeoutCount / total;
    const streamRate = m.streamInterruptCount / total;

    // Latency score: 100 if avg < 500ms, 50 if avg > 3s, linear in between
    let latencyScore = 100;
    if (m.latencies.length > 0) {
      const avg = m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length;
      latencyScore = Math.max(0, 100 - (avg - 500) / 25);
    }

    const baseScore = 100;
    const deduction =
      failureRate * 40 * FAILURE_WEIGHT +
      timeoutRate * 30 * TIMEOUT_WEIGHT +
      streamRate * 25 * STREAM_INTERRUPT_WEIGHT +
      (100 - latencyScore) * LATENCY_WEIGHT;

    m.healthScore = Math.max(0, Math.min(100, baseScore - deduction));
  }

  getHealthScore(provider: LLMProvider, model?: string): number {
    return this.getOrCreate(provider, model).healthScore;
  }

  getMetrics(provider: LLMProvider, model?: string): ProviderMetrics {
    return this.getOrCreate(provider, model);
  }

  getDetailedHealth(provider: LLMProvider, model?: string): DetailedHealth {
    const m = this.getOrCreate(provider, model);
    const total = m.successCount + m.failureCount;

    const latencies = m.latencies;
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const failureRate = total > 0 ? m.failureCount / total : 0;
    const timeoutRate = total > 0 ? m.timeoutCount / total : 0;
    const streamRate = total > 0 ? m.streamInterruptCount / total : 0;

    const timeSinceLastFailure = m.lastErrorTime > 0
      ? Date.now() - m.lastErrorTime
      : Number.POSITIVE_INFINITY;

    // Adaptive backoff based on health
    let recommendedBackoff = 0;
    if (m.healthScore < 50) {
      recommendedBackoff = Math.max(5000, timeSinceLastFailure / 4);
    } else if (m.healthScore < 75) {
      recommendedBackoff = Math.max(2000, timeSinceLastFailure / 8);
    }

    const status = m.healthScore >= 75
      ? 'healthy'
      : m.healthScore >= 50
        ? 'degraded'
        : 'down';

    return {
      provider,
      model,
      healthScore: m.healthScore,
      status,
      circuitState: m.circuitState,
      avgLatencyMs: avgLatency,
      p99LatencyMs: p99Latency,
      failureRate,
      timeoutRate,
      streamInterruptRate: streamRate,
      recommendedBackoff,
      lastFailureTime: m.lastErrorTime,
      timeSinceLastFailure,
    };
  }

  getAllHealth(): DetailedHealth[] {
    const result: DetailedHealth[] = [];
    for (const [key, _] of this.metrics) {
      const [provider, model] = key.includes(':')
        ? key.split(':')
        : [key];
      result.push(
        this.getDetailedHealth(provider as LLMProvider, model),
      );
    }
    return result;
  }

  reset(provider?: LLMProvider): void {
    if (provider) {
      for (const k of this.metrics.keys()) {
        if (k.startsWith(provider)) {
          this.metrics.delete(k);
        }
      }
      log.info(`Health metrics reset for ${provider}`);
    } else {
      this.metrics.clear();
      log.info('All health metrics reset');
    }
  }
}

export const healthTracker = new HealthTracker();
