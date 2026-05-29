/**
 * Resilience infrastructure types
 * Health scoring, concurrency control, stream recovery, backpressure handling
 */

import type { LLMProvider, CircuitState } from '../types';

// ─────────────────────── Health Scoring ───────────────────────

export interface ProviderMetrics {
  latencies: number[];           // rolling window (last 20)
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  streamInterruptCount: number;
  lastError: string | null;
  lastErrorTime: number;
  circuitState: CircuitState;
  healthScore: number;           // 0-100
}

export interface DetailedHealth {
  provider: LLMProvider;
  model?: string;
  healthScore: number;           // 0-100
  status: 'healthy' | 'degraded' | 'down';
  circuitState: CircuitState;
  avgLatencyMs: number;
  p99LatencyMs: number;
  failureRate: number;           // 0-1
  timeoutRate: number;           // 0-1
  streamInterruptRate: number;   // 0-1
  recommendedBackoff: number;    // ms to wait
  lastFailureTime: number;
  timeSinceLastFailure: number;
}

// ─────────────────────── Concurrency Control ───────────────────────

export interface ConcurrencyConfig {
  maxConcurrent: number;         // max parallel requests per provider
  maxPerProviderPerModel: number;
  queueSize: number;
  timeoutMs: number;
}

export interface ConcurrencySlot {
  provider: LLMProvider;
  model?: string;
  acquiredAt: number;
  releasedAt?: number;
}

// ─────────────────────── Stream Recovery ───────────────────────

export interface StreamRecoveryConfig {
  maxRetries: number;
  backoffMs: number;
  jitterMs: number;
  maxBackoffMs: number;
}

export interface StreamState {
  started: boolean;
  bytesReceived: number;
  chunkCount: number;
  interrupted: boolean;
  interruptedAt?: number;
  resumeCount: number;
}

// ─────────────────────── Backpressure ───────────────────────

export interface BackpressureConfig {
  highWaterMark: number;         // queue size to start slowing
  lowWaterMark: number;          // queue size to resume normal
  pauseTimeoutMs: number;
}

export interface RequestQueueItem {
  id: string;
  provider: LLMProvider;
  model: string;
  priority: number;              // 0-10, higher = more important
  createdAt: number;
  enqueueTime: number;
  signal?: AbortSignal;
}

// ─────────────────────── Request Prioritization ───────────────────────

export enum RequestPriority {
  CRITICAL = 10,
  HIGH = 7,
  NORMAL = 5,
  LOW = 2,
  DEFERRED = 0,
}

export interface PriorityQueueEntry {
  item: RequestQueueItem;
  priority: number;
}

// ─────────────────────── Cancellation ───────────────────────

export interface CancellationContext {
  signal: AbortSignal;
  controller: AbortController;
  onCancel?: () => void;
  timeoutHandle?: number;
}

// ─────────────────────── Adaptive Retry ───────────────────────

export interface AdaptiveRetryConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  providerAware: boolean;        // adjust based on provider health
}

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  nextAttempt: number;
  reason: string;
}
