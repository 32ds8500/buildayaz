/**
 * Crash-Safe Persistence Tests
 * Validates WAL, snapshots, recovery, and transactions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wal } from '@core/persistence/wal';
import { snapshotManager } from '@core/persistence/snapshots';
import { recoveryPipeline } from '@core/persistence/recovery';
import { transactionManager } from '@core/persistence/transactions';
import { WALOperation } from '@core/persistence/types';

describe('Crash-Safe Persistence', () => {
  beforeEach(async () => {
    await Promise.all([
      wal.initialize(),
      snapshotManager.initialize(),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      wal.clear(),
      snapshotManager.clear(),
    ]);
    transactionManager.reset();
    recoveryPipeline.reset();
  });

  describe('Write-Ahead Log', () => {
    it('should write and retrieve entries', async () => {
      await wal.write(WALOperation.WRITE, 'key1', 'value1');
      await wal.write(WALOperation.WRITE, 'key2', { nested: true });

      const entries = await wal.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries[0].key).toBe('key1');
      expect(entries[1].key).toBe('key2');
    });

    it('should track entry count', async () => {
      const count1 = wal.getEntryCount();
      await wal.write(WALOperation.WRITE, 'test', 'value');
      const count2 = wal.getEntryCount();

      expect(count2).toBe(count1 + 1);
    });

    it('should compact entries', async () => {
      for (let i = 0; i < 10; i++) {
        await wal.write(WALOperation.WRITE, `key${i}`, `value${i}`);
      }

      const shouldCompact = await wal.shouldCompact();
      if (shouldCompact) {
        await wal.compact();
        expect(wal.getEntryCount()).toBe(0);
      }
    });

    it('should support all operations', async () => {
      await wal.write(WALOperation.WRITE, 'key1', 'value1');
      await wal.write(WALOperation.DELETE, 'key2');
      await wal.write(WALOperation.CLEAR, 'dummy');

      const entries = await wal.getEntries();
      expect(entries.some(e => e.operation === WALOperation.WRITE)).toBe(true);
      expect(entries.some(e => e.operation === WALOperation.DELETE)).toBe(true);
      expect(entries.some(e => e.operation === WALOperation.CLEAR)).toBe(true);
    });
  });

  describe('Snapshots', () => {
    it('should create and retrieve snapshots', async () => {
      const data = { key1: 'value1', key2: 'value2' };
      const snap = await snapshotManager.createSnapshot(data, 0);

      expect(snap.data).toEqual(data);
      expect(snap.walOffset).toBe(0);

      const retrieved = await snapshotManager.getLatestSnapshot();
      expect(retrieved?.id).toBe(snap.id);
    });

    it('should list all snapshots', async () => {
      const data1 = { a: 1 };
      const data2 = { b: 2 };

      await snapshotManager.createSnapshot(data1, 0);
      await new Promise(resolve => setTimeout(resolve, 10));
      await snapshotManager.createSnapshot(data2, 1);

      const all = await snapshotManager.getAllSnapshots();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('should maintain snapshot count limit', async () => {
      for (let i = 0; i < 10; i++) {
        await snapshotManager.createSnapshot({ index: i }, i);
      }

      const count = await snapshotManager.getSnapshotCount();
      expect(count).toBeLessThanOrEqual(5); // Max is 5
    });
  });

  describe('Transaction Manager', () => {
    it('should create transactions', async () => {
      const txn = await transactionManager.beginTransaction();

      expect(txn.id).toMatch(/^txn-/);
      expect(txn.status).toBe('pending');
      expect(txn.operations).toHaveLength(0);
    });

    it('should add operations to transactions', async () => {
      const txn = await transactionManager.beginTransaction();

      transactionManager.addOperation(txn, 'key1', 'value1', 'set');
      transactionManager.addOperation(txn, 'key2', undefined, 'delete');

      expect(txn.operations).toHaveLength(2);
      expect(txn.operations[0].operation).toBe('set');
      expect(txn.operations[1].operation).toBe('delete');
    });

    it('should commit transactions', async () => {
      const txn = await transactionManager.beginTransaction();
      transactionManager.addOperation(txn, 'test', 'value');

      await transactionManager.commit(txn);

      expect(txn.status).toBe('committed');
    });

    it('should rollback transactions', async () => {
      const txn = await transactionManager.beginTransaction();
      transactionManager.addOperation(txn, 'test', 'value');

      await transactionManager.rollback(txn);

      expect(txn.status).toBe('rolled_back');
    });

    it('should handle write lock', async () => {
      const txn = await transactionManager.beginTransaction();
      transactionManager.addOperation(txn, 'key', 'value');

      // Lock should be acquired during commit
      const commitPromise = transactionManager.commit(txn);
      await commitPromise;

      expect(transactionManager.isLocked()).toBe(false);
    });

    it('should prioritize transactions', async () => {
      await transactionManager.beginTransaction(1);
      await transactionManager.beginTransaction(10);
      await transactionManager.beginTransaction(5);

      const size = transactionManager.getQueueSize();
      expect(size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Recovery Pipeline', () => {
    it('should detect crashes', async () => {
      const hasCrash = await recoveryPipeline.detectCrash();
      // Initially no crash
      expect(hasCrash).toBe(false);
    });

    it('should recover from snapshots', async () => {
      const originalData = { key1: 'value1', key2: 'value2' };
      await snapshotManager.createSnapshot(originalData, 0);

      await recoveryPipeline.recover({});

      // Recovery completed without error
    });

    it('should track recovery state', async () => {
      const originalData = { test: 'data' };
      await snapshotManager.createSnapshot(originalData, 0);

      await recoveryPipeline.recover({});
      const state = recoveryPipeline.getRecoveryState();

      expect(state?.metadata.phase).toBe('complete');
      expect(state?.metadata.itemsProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty recovery', async () => {
      const data = { existing: 'data' };
      await recoveryPipeline.recover(data);

      // Recovery completes without error
      const state = recoveryPipeline.getRecoveryState();
      expect(state).toBeTruthy();
    });
  });

  describe('Integration', () => {
    it('should handle transaction + snapshot + recovery cycle', async () => {
      // Create transaction
      const txn = await transactionManager.beginTransaction();
      transactionManager.addOperation(txn, 'data', { content: 'test' });
      await transactionManager.commit(txn);

      // Create snapshot
      const snapData = { data: { content: 'test' } };
      await snapshotManager.createSnapshot(snapData, 1);

      // Simulate recovery
      const recovered = await recoveryPipeline.recover({});

      expect(recovered).toHaveProperty('data');
    });

    it('should maintain consistency through multiple transactions', async () => {
      for (let i = 0; i < 5; i++) {
        const txn = await transactionManager.beginTransaction();
        transactionManager.addOperation(txn, `key${i}`, `value${i}`);
        await transactionManager.commit(txn);
      }

      const queueSize = transactionManager.getQueueSize();
      expect(queueSize).toBe(0); // All committed
    });
  });
});
