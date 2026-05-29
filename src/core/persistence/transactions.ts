/**
 * Transaction Queue & Write Mutex
 * Ensures serialized, atomic, crash-safe writes
 */

import { logger as llmLogger } from '../llm/logging/logger';
import { wal } from './wal';
import type { Transaction, WALOperation } from './types';
import { WALOperation as WalOp } from './types';

const loggerInstance = llmLogger.forModule?.('Transactions') || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const log = loggerInstance;

class TransactionManager {
  private queue: Transaction[] = [];
  private activeTransaction: Transaction | null = null;
  private writeLock: { owner: string; until: number } | null = null;
  private readonly LOCK_TIMEOUT = 30_000;

  async beginTransaction(priority = 0): Promise<Transaction> {
    const txn: Transaction = {
      id: `txn-${Date.now()}-${Math.random()}`,
      operations: [],
      timestamp: Date.now(),
      priority,
      status: 'pending',
    };

    this.queue.push(txn);
    this.queue.sort((a, b) => b.priority - a.priority);

    log.debug(`Transaction created: ${txn.id} (priority: ${priority})`);
    return txn;
  }

  addOperation(
    txn: Transaction,
    key: string,
    value?: unknown,
    operation: 'set' | 'delete' = 'set',
  ): void {
    if (txn.status !== 'pending') {
      throw new Error(`Cannot add operation to ${txn.status} transaction`);
    }

    txn.operations.push({ key, value, operation });
    log.debug(`Operation added to ${txn.id}: ${operation} ${key}`);
  }

  async commit(txn: Transaction): Promise<void> {
    if (txn.status !== 'pending') {
      throw new Error(`Cannot commit ${txn.status} transaction`);
    }

    txn.status = 'writing';

    try {
      // Acquire write lock
      await this.acquireLock(txn.id);

      // Write all operations to WAL
      for (const op of txn.operations) {
        const operation: WALOperation = op.operation === 'set' ? WalOp.WRITE : WalOp.DELETE;
        await wal.write(operation, op.key, op.value);
      }

      txn.status = 'committed';
      log.info(`Transaction committed: ${txn.id} (${txn.operations.length} ops)`);

      // Remove from queue
      this.queue = this.queue.filter(t => t.id !== txn.id);
    } catch (err) {
      txn.status = 'rolled_back';
      log.error(`Transaction failed: ${txn.id} - ${err}`);
      throw err;
    } finally {
      this.releaseLock(txn.id);
    }
  }

  async rollback(txn: Transaction): Promise<void> {
    txn.status = 'rolled_back';
    log.info(`Transaction rolled back: ${txn.id}`);
    this.queue = this.queue.filter(t => t.id !== txn.id);
  }

  private async acquireLock(owner: string): Promise<void> {
    const deadline = Date.now() + this.LOCK_TIMEOUT;

    while (true) {
      if (!this.writeLock || this.writeLock.until < Date.now()) {
        this.writeLock = {
          owner,
          until: deadline,
        };
        return;
      }

      if (Date.now() > deadline) {
        throw new Error('Write lock acquisition timeout');
      }

      // Wait 10ms before retrying
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private releaseLock(owner: string): void {
    if (this.writeLock?.owner === owner) {
      this.writeLock = null;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getTransaction(id: string): Transaction | undefined {
    return this.queue.find(t => t.id === id) || (this.activeTransaction?.id === id ? this.activeTransaction : undefined);
  }

  isLocked(): boolean {
    return this.writeLock !== null && this.writeLock.until > Date.now();
  }

  reset(): void {
    this.queue = [];
    this.activeTransaction = null;
    this.writeLock = null;
    log.info('Transaction manager reset');
  }
}

export const transactionManager = new TransactionManager();
