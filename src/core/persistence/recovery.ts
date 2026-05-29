/**
 * Recovery Pipeline
 * Handles crash recovery: detection, validation, replay, and verification
 */

import { logger as llmLogger } from '../llm/logging/logger';
import { wal } from './wal';
import { snapshotManager } from './snapshots';
import type { RecoveryCheckpoint, RecoveryMetadata } from './types';
import { RecoveryPhase } from './types';

const loggerInstance = llmLogger.forModule?.('Recovery') || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const log = loggerInstance;

interface RecoveryState {
  metadata: RecoveryMetadata;
  checkpoint: RecoveryCheckpoint | null;
  recoveredData: Record<string, unknown>;
}

class RecoveryPipeline {
  private recoveryState: RecoveryState | null = null;
  private isRecoveringFlag = false;

  async detectCrash(): Promise<boolean> {
    try {
      // Check if WAL has unprocessed entries
      const state = await wal.getState();
      if (state.size > 0) {
        log.warn('Unprocessed WAL entries detected - recovery needed');
        return true;
      }

      return false;
    } catch (err) {
      log.warn(`Crash detection error: ${err}`);
      return true; // Assume crash on error
    }
  }

  async recover(
    currentData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isRecoveringFlag) {
      throw new Error('Recovery already in progress');
    }

    this.isRecoveringFlag = true;

    try {
      this.recoveryState = {
        metadata: {
          phase: RecoveryPhase.DETECTION,
          startTime: Date.now(),
          itemsProcessed: 0,
          itemsFailed: 0,
        },
        checkpoint: null,
        recoveredData: { ...currentData },
      };

      log.info('Starting recovery pipeline...');

      // Phase 1: Detection
      await this.phaseDetection();

      // Phase 2: Validation
      await this.phaseValidation();

      // Phase 3: Replay
      await this.phaseReplay();

      // Phase 4: Verification
      await this.phaseVerification();

      this.recoveryState.metadata.phase = RecoveryPhase.COMPLETE;
      log.info(
        `Recovery complete: ${this.recoveryState.metadata.itemsProcessed} items processed, ` +
        `${this.recoveryState.metadata.itemsFailed} failed`,
      );

      return this.recoveryState.recoveredData;
    } catch (err) {
      log.error(`Recovery failed: ${err}`);
      this.recoveryState!.metadata.lastError = String(err);
      throw err;
    } finally {
      this.isRecoveringFlag = false;
    }
  }

  private async phaseDetection(): Promise<void> {
    if (!this.recoveryState) return;

    this.recoveryState.metadata.phase = RecoveryPhase.DETECTION;
    log.info('Phase 1: Detection');

    // Try to load latest snapshot
    const snapshot = await snapshotManager.getLatestSnapshot();
    if (snapshot) {
      log.info(`Found snapshot: ${snapshot.id} (age: ${Date.now() - snapshot.timestamp}ms)`);
      this.recoveryState.recoveredData = { ...snapshot.data };

      this.recoveryState.checkpoint = {
        timestamp: snapshot.timestamp,
        walOffset: snapshot.walOffset,
        recoveredItems: Object.keys(snapshot.data).length,
        integrityOk: true,
      };
    }
  }

  private async phaseValidation(): Promise<void> {
    if (!this.recoveryState) return;

    this.recoveryState.metadata.phase = RecoveryPhase.VALIDATION;
    log.info('Phase 2: Validation');

    // Validate current data
    for (const [key, value] of Object.entries(this.recoveryState.recoveredData)) {
      if (value === undefined || value === null) {
        this.recoveryState.metadata.itemsFailed++;
        delete this.recoveryState.recoveredData[key];
      }
    }

    log.info(
      `Validated ${this.recoveryState.metadata.itemsProcessed} items, ` +
      `${this.recoveryState.metadata.itemsFailed} invalid`,
    );
  }

  private async phaseReplay(): Promise<void> {
    if (!this.recoveryState) return;

    this.recoveryState.metadata.phase = RecoveryPhase.REPLAY;
    log.info('Phase 3: Replay');

    // Get WAL entries starting from checkpoint
    const walOffset = this.recoveryState.checkpoint?.walOffset ?? 0;
    const entries = await wal.getEntries(walOffset);

    for (const entry of entries) {
      try {
        // Apply operation
        switch (entry.operation) {
          case 'write':
            this.recoveryState.recoveredData[entry.key] = entry.value;
            break;
          case 'delete':
            delete this.recoveryState.recoveredData[entry.key];
            break;
          case 'clear':
            this.recoveryState.recoveredData = {};
            break;
        }

        this.recoveryState.metadata.itemsProcessed++;
      } catch (err) {
        log.warn(`Failed to replay WAL entry ${entry.id}: ${err}`);
        this.recoveryState.metadata.itemsFailed++;
      }
    }

    log.info(
      `Replayed ${this.recoveryState.metadata.itemsProcessed} WAL entries`,
    );
  }

  private async phaseVerification(): Promise<void> {
    if (!this.recoveryState) return;

    this.recoveryState.metadata.phase = RecoveryPhase.VERIFICATION;
    log.info('Phase 4: Verification');

    // Basic integrity checks
    const dataSize = JSON.stringify(this.recoveryState.recoveredData).length;
    const maxSize = 10 * 1024 * 1024; // 10MB limit

    if (dataSize > maxSize) {
      log.error(`Recovered data exceeds size limit: ${dataSize} bytes`);
      throw new Error('Recovered data too large');
    }

    log.info(
      `Recovery verified: ${Object.keys(this.recoveryState.recoveredData).length} keys, ` +
      `${dataSize} bytes`,
    );
  }

  isRecovering(): boolean {
    return this.isRecoveringFlag;
  }

  getRecoveryState(): RecoveryState | null {
    return this.recoveryState;
  }

  reset(): void {
    this.recoveryState = null;
    log.info('Recovery state reset');
  }
}

export const recoveryPipeline = new RecoveryPipeline();
