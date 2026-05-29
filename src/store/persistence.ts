const SCHEMA_VERSION = 1;
/**
 * Persistence layer — IDB primary, localStorage fallback
 * Debounced writes to prevent excessive I/O on rapid edits
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Project } from './types';

const DB_NAME    = 'kodyap_v2';
const DB_VERSION = 1;
const STORE      = 'projects';

let _db: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    }).catch(err => {
      // IDB unavailable (private browsing on some browsers) — reset promise so retry is possible
      _db = null;
      throw err;
    });
  }
  return _db;
}

// ─── IDB operations ───────────────────────────────────────────────────────────

export async function idbSaveAll(projects: Project[]): Promise<void> {
  try {
    const database = await db();
    const tx = database.transaction(STORE, 'readwrite');
    // Clear + rewrite approach: simple and consistent
    await tx.store.clear();
    for (const p of projects) {
      await tx.store.put(p);
    }
    await tx.done;
  } catch {
    // Fall back to localStorage
    lsSave(projects);
  }
}

export async function idbLoadAll(): Promise<Project[]> {
  try {
    const database = await db();
    return (await database.getAll(STORE)) as Project[];
  } catch {
    return lsLoad();
  }
}

export async function idbDelete(id: string): Promise<void> {
  try {
    const database = await db();
    await database.delete(STORE, id);
  } catch {
    const current = lsLoad();
    lsSave(current.filter(p => p.id !== id));
  }
}

// ─── localStorage fallback ────────────────────────────────────────────────────

const LS_KEY = 'kodyap_projects';

export function lsLoad(): Project[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function lsSave(projects: Project[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, projects }));
  } catch {
    // Quota exceeded — remove oldest project and retry once
    try {
      const trimmed = projects.slice(-5);
      localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    } catch { /* give up */ }
  }
}

// ─── Debouncer ────────────────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced save — waits 800 ms after the last call before writing.
 * Immediate=true bypasses debounce (used on beforeunload).
 */
export function scheduleSave(projects: Project[], immediate = false): void {
  if (_saveTimer !== null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }

  if (immediate) {
    // Synchronous localStorage write as last resort (beforeunload)
    lsSave(projects);
    // Async IDB write (may not complete before unload, but worth trying)
    idbSaveAll(projects).catch((err) => { console.warn("[auto-catch]", err); });
    return;
  }

  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    idbSaveAll(projects).catch(() => lsSave(projects));
  }, 800);
}

// ─── Load on startup (async, tries IDB then falls back) ──────────────────────

let _loadedProjects: Project[] | null = null;
let _loadPromise: Promise<Project[]> | null = null;

export function loadProjectsSync(): Project[] {
  // Return whatever we have synchronously (localStorage)
  return lsLoad();
}

export async function loadProjectsAsync(): Promise<Project[]> {
  if (_loadedProjects !== null) return _loadedProjects;
  if (_loadPromise) return _loadPromise;

  _loadPromise = idbLoadAll().then(projects => {
    _loadedProjects = projects.length > 0 ? projects : lsLoad();
    return _loadedProjects;
  });

  return _loadPromise;
}
