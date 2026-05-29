/**
 * Write-Ahead Log (WAL)
 * Journals all writes before commit to ensure durability
 */

import { logger as llmLogger } from '../llm/logging/logger';
import type { WALEntry, WALOperation, WALState } from './types';

const loggerInstance = llmLogger.forModule?.('WAL') || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const log = loggerInstance;

const DB_NAME = 'buildayaz-wal';
const STORE_NAME = 'entries';

class WriteAheadLog {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private entryCount = 0;
  private lastCompactTime = Date.now();
  private compactThreshold = 10_000;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const request = indexedDB.open(DB_NAME, 1);

      await new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          this.isInitialized = true;
          resolve();
        };
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
      });

      log.info('WAL initialized');
    } catch (err) {
      log.error(`WAL initialization failed: ${err}`);
      throw err;
    }
  }

  async write(
    operation: WALOperation,
    key: string,
    value?: unknown,
  ): Promise<string> {
    if (!this.db) throw new Error('WAL not initialized');

    const entry: WALEntry = {
      id: `wal-${Date.now()}-${Math.random()}`,
      operation,
      key,
      value,
      timestamp: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(entry);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => {
        this.entryCount++;
        resolve();
      };
    });

    log.debug(`WAL entry written: ${entry.id} (${operation} ${key})`);
    return entry.id;
  }

  async getEntries(offset = 0, limit = 1000): Promise<WALEntry[]> {
    if (!this.db) throw new Error('WAL not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = (request.result as WALEntry[]) || [];
        resolve(entries.slice(offset, offset + limit));
      };
    });
  }

  async getState(): Promise<WALState> {
    return {
      entries: [],
      offset: 0,
      size: this.entryCount,
      lastCompactTime: this.lastCompactTime,
    };
  }

  async compact(): Promise<void> {
    if (!this.db) throw new Error('WAL not initialized');

    log.info('Compacting WAL...');

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        tx.oncomplete = () => {
          this.entryCount = 0;
          this.lastCompactTime = Date.now();
          log.info('WAL compacted successfully');
          resolve();
        };
      });
    } catch (err) {
      log.error(`WAL compact failed: ${err}`);
      throw err;
    }
  }

  async shouldCompact(): Promise<boolean> {
    return this.entryCount >= this.compactThreshold;
  }

  async clear(): Promise<void> {
    if (!this.db) throw new Error('WAL not initialized');

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => {
        this.entryCount = 0;
        log.info('WAL cleared');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  getEntryCount(): number {
    return this.entryCount;
  }
}

export const wal = new WriteAheadLog();
