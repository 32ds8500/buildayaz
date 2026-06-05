/**
 * IndexedDB-backed Virtual File System
 * Persists projects efficiently with lazy-loading support
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'kodyap_vfs';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const FILES_STORE = 'files';

interface StoredProject {
  id: string;
  name: string;
  description: string;
  template: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredFile {
  id: string; // projectId + path
  projectId: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  size: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          const store = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId');
          store.createIndex('path', ['projectId', 'path']);
        }
      },
    });
  }
  return dbPromise;
}

export const VFS = {
  // ─── Project Operations ───
  async saveProject(project: StoredProject): Promise<void> {
    const db = await getDB();
    await db.put(PROJECTS_STORE, { ...project, updatedAt: Date.now() });
  },

  async getProject(id: string): Promise<StoredProject | undefined> {
    const db = await getDB();
    return db.get(PROJECTS_STORE, id);
  },

  async getAllProjects(): Promise<StoredProject[]> {
    const db = await getDB();
    return db.getAll(PROJECTS_STORE);
  },

  async deleteProject(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(PROJECTS_STORE, id);
    // Delete all files
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const index = tx.store.index('projectId');
    let cursor = await index.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  },

  // ─── File Operations ───
  async saveFile(projectId: string, path: string, name: string, type: 'file' | 'folder', content?: string, language?: string): Promise<void> {
    const db = await getDB();
    await db.put(FILES_STORE, {
      id: `${projectId}:${path}`,
      projectId,
      path,
      name,
      type,
      content: content || '',
      language: language || '',
      size: content?.length || 0,
      updatedAt: Date.now(),
    });
  },

  async getFile(projectId: string, path: string): Promise<StoredFile | undefined> {
    const db = await getDB();
    return db.get(FILES_STORE, `${projectId}:${path}`);
  },

  async getProjectFiles(projectId: string): Promise<StoredFile[]> {
    const db = await getDB();
    return db.getAllFromIndex(FILES_STORE, 'projectId', projectId);
  },

  async deleteFile(projectId: string, path: string): Promise<void> {
    const db = await getDB();
    await db.delete(FILES_STORE, `${projectId}:${path}`);
  },

  async updateFileContent(projectId: string, path: string, content: string): Promise<void> {
    const db = await getDB();
    const existing = await db.get(FILES_STORE, `${projectId}:${path}`);
    if (existing) {
      existing.content = content;
      existing.size = content.length;
      existing.updatedAt = Date.now();
      await db.put(FILES_STORE, existing);
    }
  },

  // ─── Batch Operations ───
  async saveProjectWithFiles(project: StoredProject, files: { path: string; name: string; type: 'file' | 'folder'; content?: string; language?: string }[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction([PROJECTS_STORE, FILES_STORE], 'readwrite');
    
    await tx.objectStore(PROJECTS_STORE).put({ ...project, updatedAt: Date.now() });
    
    for (const f of files) {
      await tx.objectStore(FILES_STORE).put({
        id: `${project.id}:${f.path}`,
        projectId: project.id,
        path: f.path,
        name: f.name,
        type: f.type,
        content: f.content || '',
        language: f.language || '',
        size: f.content?.length || 0,
        updatedAt: Date.now(),
      });
    }
    
    await tx.done;
  },

  // ─── Search ───
  async searchFiles(projectId: string, query: string): Promise<StoredFile[]> {
    const files = await this.getProjectFiles(projectId);
    const lower = query.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(lower) ||
      f.path.toLowerCase().includes(lower) ||
      (f.content && f.content.toLowerCase().includes(lower))
    );
  },

  // ─── Stats ───
  async getProjectStats(projectId: string): Promise<{ fileCount: number; totalSize: number }> {
    const files = await this.getProjectFiles(projectId);
    return {
      fileCount: files.filter(f => f.type === 'file').length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
    };
  },
};
