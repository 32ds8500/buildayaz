/**
 * Stream Recovery System
 * Handles interrupted streams, partial chunks, and reconnect attempts
 */

import type { LLMStreamChunk } from '../types';
import { logger } from '../logging/logger';
import type { StreamRecoveryConfig, StreamState } from './types';

const log = logger.forModule('StreamRecovery');

const DEFAULT_CONFIG: StreamRecoveryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  jitterMs: 500,
  maxBackoffMs: 30_000,
};

export interface StreamRecoveryPoint {
  chunkCount: number;
  bytesReceived: number;
  lastContent?: string;
  timestamp: number;
}

class StreamRecoveryManager {
  private recoveryPoints = new Map<string, StreamRecoveryPoint[]>();
  private streamStates = new Map<string, StreamState>();
  private config: StreamRecoveryConfig;

  constructor(config: Partial<StreamRecoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initializeStream(streamId: string): void {
    this.streamStates.set(streamId, {
      started: true,
      bytesReceived: 0,
      chunkCount: 0,
      interrupted: false,
      resumeCount: 0,
    });
    this.recoveryPoints.set(streamId, []);
  }

  recordChunk(streamId: string, chunk: LLMStreamChunk, bytes: number): void {
    const state = this.streamStates.get(streamId);
    if (!state) return;

    state.bytesReceived += bytes;
    state.chunkCount++;

    const points = this.recoveryPoints.get(streamId) ?? [];
    points.push({
      chunkCount: state.chunkCount,
      bytesReceived: state.bytesReceived,
      lastContent: chunk.content ?? chunk.error,
      timestamp: Date.now(),
    });

    // Keep last 10 recovery points
    if (points.length > 10) points.shift();
    this.recoveryPoints.set(streamId, points);
  }

  markInterrupted(streamId: string): void {
    const state = this.streamStates.get(streamId);
    if (state) {
      state.interrupted = true;
      state.interruptedAt = Date.now();
      state.resumeCount++;
      log.warn(`Stream interrupted: ${streamId} (attempt ${state.resumeCount})`);
    }
  }

  canRetry(streamId: string): boolean {
    const state = this.streamStates.get(streamId);
    if (!state) return false;
    return state.resumeCount <= this.config.maxRetries;
  }

  getRetryDelay(streamId: string): number {
    const state = this.streamStates.get(streamId);
    if (!state) return 0;

    const attempt = state.resumeCount - 1;
    const exponential = this.config.backoffMs * Math.pow(2, attempt);
    const withJitter = exponential + Math.random() * this.config.jitterMs;
    return Math.min(withJitter, this.config.maxBackoffMs);
  }

  getRecoveryPoint(streamId: string): StreamRecoveryPoint | undefined {
    const points = this.recoveryPoints.get(streamId);
    return points?.[points.length - 1];
  }

  getState(streamId: string): StreamState | undefined {
    return this.streamStates.get(streamId);
  }

  async delayBeforeRetry(streamId: string): Promise<void> {
    const delay = this.getRetryDelay(streamId);
    if (delay > 0) {
      return new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  finishStream(streamId: string): void {
    const state = this.streamStates.get(streamId);
    if (state) {
      state.interrupted = false;
      log.info(`Stream completed: ${streamId} (${state.chunkCount} chunks, ${state.bytesReceived} bytes)`);
    }
  }

  cleanup(streamId: string): void {
    this.streamStates.delete(streamId);
    this.recoveryPoints.delete(streamId);
  }

  reset(): void {
    this.streamStates.clear();
    this.recoveryPoints.clear();
    log.info('Stream recovery manager reset');
  }
}

export const streamRecoveryManager = new StreamRecoveryManager();
