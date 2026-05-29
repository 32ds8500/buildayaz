/**
 * Crash-Safe Persistence Module
 * Write-Ahead Logging, Snapshots, Recovery, and Transactions
 */

export type {
  WALEntry,
  WALState,
  Snapshot,
  SnapshotManifest,
  RecoveryMetadata,
  RecoveryCheckpoint,
  Transaction,
  WriteLock,
  PersistenceConfig,
} from './types';

export { WALOperation, RecoveryPhase } from './types';

export { wal } from './wal';
export { snapshotManager } from './snapshots';
export { recoveryPipeline } from './recovery';
export { transactionManager } from './transactions';
export { persistenceWriteQueue, WriteQueue } from './writeQueue';
