/**
 * Crash-Safe Persistence Types
 * Write-Ahead Logging, Snapshots, Recovery, and Transaction Queue
 */

// ─────────────────────── Write-Ahead Log ───────────────────────

export enum WALOperation {
  WRITE = 'write',
  DELETE = 'delete',
  CLEAR = 'clear',
  COMPACT = 'compact',
}

export interface WALEntry {
  id: string;
  operation: WALOperation;
  key: string;
  value?: unknown;
  timestamp: number;
  checksum?: string;
}

export interface WALState {
  entries: WALEntry[];
  offset: number;
  size: number;
  lastCompactTime: number;
}

// ─────────────────────── Snapshots ───────────────────────

export interface Snapshot {
  id: string;
  timestamp: number;
  walOffset: number;
  dataHash: string;
  data: Record<string, unknown>;
  metadata: {
    size: number;
    compressed: boolean;
    version: number;
  };
}

export interface SnapshotManifest {
  snapshots: Snapshot[];
  latest: string;
  lastGarbageCollection: number;
}

// ─────────────────────── Recovery ───────────────────────

export enum RecoveryPhase {
  DETECTION = 'detection',
  VALIDATION = 'validation',
  REPLAY = 'replay',
  VERIFICATION = 'verification',
  COMPLETE = 'complete',
}

export interface RecoveryMetadata {
  phase: RecoveryPhase;
  startTime: number;
  lastError?: string;
  itemsProcessed: number;
  itemsFailed: number;
}

export interface RecoveryCheckpoint {
  timestamp: number;
  walOffset: number;
  recoveredItems: number;
  integrityOk: boolean;
}

// ─────────────────────── Transaction Queue ───────────────────────

export interface Transaction {
  id: string;
  operations: Array<{
    key: string;
    value?: unknown;
    operation: 'set' | 'delete';
  }>;
  timestamp: number;
  priority: number;
  status: 'pending' | 'writing' | 'committed' | 'rolled_back';
  checksum?: string;
}

// ─────────────────────── Write Mutex ───────────────────────

export interface WriteLock {
  acquiredAt: number;
  owner: string;
  timeout: number;
}

// ─────────────────────── Configuration ───────────────────────

export interface PersistenceConfig {
  walCompactThreshold: number;        // entries before compact
  snapshotInterval: number;           // ms between snapshots
  maxSnapshots: number;
  recoveryCheckpointInterval: number;
  transactionQueueSize: number;
  enableChecksum: boolean;
  enableCompression: boolean;
}
