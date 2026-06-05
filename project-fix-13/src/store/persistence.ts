/**
 * Persistence Layer — Production-grade
 *
 * Strategy:
 * - IndexedDB is the single source of truth
 * - localStorage is a fallback only (for IDB-unavailable environments)
 * - Writes are debounced (800ms) on hot path, immediate for structural ops
 * - Corruption recovery: validates data schema before returning
 * - Migration: version-based schema upgrades via IDB upgrade callback
 * - Transaction safety: clear+write in a single transaction
 *
 * IDB Schema:
 *   DB: kodyap_v3  (v3 = added schema validation)
 *   Store: projects  (keyPath: 'id')
 */

import { openDB, type IDBPDatabase } from 'idb';

// ─── Types (inline to avoid circular dep with projectStore) ──────────────────

interface PersistedProject {
  id: string;
  name: string;
  description: string;
  template: string;
  files: unknown[];
  createdAt: number;
}

// ─── Schema validation ────────────────────────────────────────────────────────

function isValidProject(p: unknown): p is PersistedProject {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    Array.isArray(obj['files']) &&
    typeof obj['createdAt'] === 'number'
  );
}

function validateProjects(raw: unknown[]): PersistedProject[] {
  return raw.filter(isValidProject);
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

const DB_NAME    = 'kodyap_v3';
const DB_VERSION = 1;
const STORE      = 'projects';

// Previous DB names to migrate from
const LEGACY_DB_NAMES = ['kodyap_v2', 'kodyap_projects'];

let _db: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, tx) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
        // Migrate from legacy stores if first upgrade
        if (oldVersion === 0) {
          void migrateLegacyData(tx.objectStore(STORE));
        }
      },
    }).catch(err => {
      _db = null; // Reset so next call retries
      throw err;
    });
  }
  return _db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function migrateLegacyData(store: any): Promise<void> {
  // Try to pull data from old IDB
  for (const legacyName of LEGACY_DB_NAMES) {
    try {
      const legacyDb = await openDB(legacyName, 1);
      const storeNames = Array.from(legacyDb.objectStoreNames);
      if (storeNames.includes('projects')) {
        const tx2 = legacyDb.transaction('projects', 'readonly');
        const items = await tx2.store.getAll();
        const valid = validateProjects(items);
        for (const item of valid) {
          await store.put(item);
        }
        console.info(`[persistence] Migrated ${valid.length} projects from ${legacyName}`);
      }
      legacyDb.close();
    } catch { /* legacy DB may not exist */ }
  }
  // Also check localStorage
  const lsData = lsLoad();
  for (const item of lsData) {
    if (isValidProject(item)) {
      try { await store.put(item); } catch { /* may already exist */ }
    }
  }
}

// ─── IDB operations ───────────────────────────────────────────────────────────

export async function idbSaveAll(projects: PersistedProject[]): Promise<void> {
  try {
    const database = await db();
    const tx = database.transaction(STORE, 'readwrite');
    await tx.store.clear();
    for (const p of projects) {
      await tx.store.put(p);
    }
    await tx.done;
  } catch (err) {
    console.debug('[persistence] IDB save failed, falling back to localStorage:', err);
    lsSave(projects);
  }
}

export async function idbLoadAll(): Promise<PersistedProject[]> {
  try {
    const database = await db();
    const raw = await database.getAll(STORE);
    return validateProjects(raw); // Corruption recovery: filter invalid
  } catch (err) {
    console.debug('[persistence] IDB load failed, using localStorage:', err);
    return lsLoad();
  }
}

export async function idbDelete(id: string): Promise<void> {
  try {
    const database = await db();
    await database.delete(STORE, id);
  } catch (err) {
    console.debug('[persistence] IDB delete failed:', err);
    lsSave(lsLoad().filter(p => p.id !== id));
  }
}

// ─── localStorage fallback ────────────────────────────────────────────────────

const LS_KEY = 'kodyap_projects_v3';
const LS_LEGACY_KEYS = ['kodyap_projects', 'kodyap_v2_projects'];

export function lsLoad(): PersistedProject[] {
  // Try current key
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[];
      const valid = validateProjects(Array.isArray(parsed) ? parsed : []);
      if (valid.length > 0) return valid;
    }
  } catch { /* corrupt — try legacy */ }

  // Try legacy keys
  for (const key of LS_LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        const valid = validateProjects(Array.isArray(parsed) ? parsed : []);
        if (valid.length > 0) {
          // Migrate to new key
          lsSave(valid);
          return valid;
        }
      }
    } catch { /* corrupt */ }
  }

  return [];
}

export function lsSave(projects: PersistedProject[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(projects));
  } catch {
    // Quota exceeded — keep only last 5 projects
    try {
      const trimmed = projects.slice(-5);
      localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
      console.warn('[persistence] localStorage quota exceeded, keeping last 5 projects');
    } catch { /* storage completely full */ }
  }
}

// ─── Write queue (prevents overlapping IDB transactions) ─────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingProjects: PersistedProject[] | null = null;
let _isSaving = false;

async function flushNow(projects: PersistedProject[]): Promise<void> {
  if (_isSaving) return; // Already saving — will pick up _pendingProjects
  _isSaving = true;
  try {
    await idbSaveAll(projects);
  } finally {
    _isSaving = false;
    // If more saves queued while we were saving
    if (_pendingProjects) {
      const next = _pendingProjects;
      _pendingProjects = null;
      await flushNow(next);
    }
  }
}

/**
 * Schedule a save.
 * - immediate=false: debounced 800ms (for content edits)
 * - immediate=true: synchronous localStorage + async IDB (for structural ops)
 */
export function scheduleSave(projects: PersistedProject[], immediate = false): void {
  if (_saveTimer !== null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }

  if (immediate) {
    lsSave(projects); // synchronous fallback
    if (_isSaving) {
      _pendingProjects = projects;
    } else {
      flushNow(projects).catch(err => console.warn('[persistence] Immediate save failed:', err));
    }
    return;
  }

  _pendingProjects = projects;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    const toSave = _pendingProjects ?? projects;
    _pendingProjects = null;
    flushNow(toSave).catch(err => {
      console.warn('[persistence] Debounced save failed:', err);
      lsSave(toSave);
    });
  }, 800);
}

// ─── Load on startup ──────────────────────────────────────────────────────────

let _loadedProjects: PersistedProject[] | null = null;
let _loadPromise: Promise<PersistedProject[]> | null = null;

export function loadProjectsSync(): PersistedProject[] {
  return lsLoad(); // Synchronous — localStorage only
}

export async function loadProjectsAsync(): Promise<PersistedProject[]> {
  if (_loadedProjects !== null) return _loadedProjects;
  if (_loadPromise) return _loadPromise;

  _loadPromise = idbLoadAll().then(projects => {
    _loadedProjects = projects.length > 0 ? projects : lsLoad();
    // If IDB returned data, sync it to localStorage as backup
    if (projects.length > 0) lsSave(projects);
    return _loadedProjects;
  });

  return _loadPromise;
}

/** Force reset persistence cache (for testing) */
export function _resetPersistenceCache(): void {
  _db = null;
  _loadedProjects = null;
  _loadPromise = null;
  _pendingProjects = null;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
}
