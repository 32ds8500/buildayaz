/**
 * Snapshot Manager
 * Creates and manages periodic snapshots for recovery
 */

import { logger as llmLogger } from '../llm/logging/logger';
import type { Snapshot } from './types';

const loggerInstance = llmLogger.forModule?.('Snapshots') || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const log = loggerInstance;

const DB_NAME = 'buildayaz-snapshots';
const STORE_NAME = 'snapshots';

class SnapshotManager {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private maxSnapshots = 5;

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

      log.info('Snapshot manager initialized');
    } catch (err) {
      log.error(`Snapshot manager initialization failed: ${err}`);
      throw err;
    }
  }

  async createSnapshot(
    data: Record<string, unknown>,
    walOffset: number,
  ): Promise<Snapshot> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    const snapshot: Snapshot = {
      id: `snap-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      walOffset,
      dataHash: JSON.stringify(data).substring(0, 16),
      data,
      metadata: {
        size: JSON.stringify(data).length,
        compressed: false,
        version: 1,
      },
    };

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(snapshot);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => {
        log.info(`Snapshot created: ${snapshot.id} (${snapshot.metadata.size} bytes)`);
        resolve();
      };
    });

    // Clean up old snapshots
    await this.pruneOldSnapshots();

    return snapshot;
  }

  async getLatestSnapshot(): Promise<Snapshot | null> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const snapshots = (request.result as Snapshot[]) || [];
        if (snapshots.length === 0) {
          resolve(null);
          return;
        }

        const latest = snapshots.reduce((prev, current) =>
          current.timestamp > prev.timestamp ? current : prev,
        );

        resolve(latest);
      };
    });
  }

  async getAllSnapshots(): Promise<Snapshot[]> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const snapshots = (request.result as Snapshot[]) || [];
        snapshots.sort((a, b) => b.timestamp - a.timestamp);
        resolve(snapshots);
      };
    });
  }

  private async pruneOldSnapshots(): Promise<void> {
    if (!this.db) return;

    const snapshots = await this.getAllSnapshots();
    if (snapshots.length <= this.maxSnapshots) return;

    const toDelete = snapshots.slice(this.maxSnapshots);

    for (const snap of toDelete) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(snap.id);

        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve();
      });
    }

    log.info(`Pruned ${toDelete.length} old snapshots`);
  }

  async deleteSnapshot(id: string): Promise<void> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => {
        log.info(`Snapshot deleted: ${id}`);
        resolve();
      };
    });
  }

  async clear(): Promise<void> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => {
        log.info('All snapshots cleared');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSnapshotCount(): Promise<number> {
    if (!this.db) throw new Error('Snapshot manager not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

export const snapshotManager = new SnapshotManager();
