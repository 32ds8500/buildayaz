/**
 * Autosave System — production-grade
 *
 * Strategies (in order of reliability):
 * 1. Debounced (800ms)   — hot path content edits
 * 2. Periodic (30s)      — safety net for stalled debounce
 * 3. visibilitychange    — immediate flush when tab hides
 * 4. beforeunload        — synchronous localStorage + async IDB
 * 5. pagehide            — more reliable than beforeunload on mobile
 *
 * The persistence layer handles transaction safety and IDB/LS coordination.
 */

import { scheduleSave } from './persistence';
import { logger } from '../core/llm/logging/logger';
import { useProjectStore } from './projectStore';

const log = logger.forModule('Autosave');

const PERIODIC_INTERVAL_MS  = 30_000;
const IDLE_TIMEOUT_MS        = 5_000;  // save after 5s of no typing

let _periodicTimer: ReturnType<typeof setInterval> | null = null;
let _idleTimer:     ReturnType<typeof setTimeout>  | null = null;
let _initialized    = false;
let _lastSaveAt     = 0;
let _dirtyCount     = 0;   // number of changes since last save

// ─── Core flush ──────────────────────────────────────────────────────────────

function getProjects() {
  return useProjectStore.getState().projects;
}

function flush(immediate: boolean, reason: string): void {
  const projects = getProjects();
  if (!projects.length) return;

  _lastSaveAt = Date.now();
  _dirtyCount = 0;
  log.debug(reason, 'Autosave flush', { count: projects.length, immediate });
  scheduleSave(projects, immediate);
}

// ─── Idle detection (save after user stops typing) ───────────────────────────

export function markDirty(): void {
  _dirtyCount++;
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    _idleTimer = null;
    if (_dirtyCount > 0) flush(false, 'idle-timeout');
  }, IDLE_TIMEOUT_MS);
}

// ─── Event handlers ──────────────────────────────────────────────────────────

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flush(true, 'visibilitychange');
}

function onBeforeUnload() {
  flush(true, 'beforeunload');
}

function onPageHide() {
  // More reliable than beforeunload on iOS Safari and some Chrome mobile
  flush(true, 'pagehide');
}

function onFocus() {
  // When window regains focus, verify last save was recent
  const age = Date.now() - _lastSaveAt;
  if (age > 60_000 && _dirtyCount > 0) flush(false, 'focus-recovery');
}

// ─── Init / teardown ─────────────────────────────────────────────────────────

export function initAutosave(): () => void {
  if (_initialized) return () => {};
  _initialized = true;

  // Strategy 2: periodic
  _periodicTimer = setInterval(() => {
    if (_dirtyCount > 0) flush(false, 'periodic');
  }, PERIODIC_INTERVAL_MS);

  // Strategy 3: visibility
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Strategy 4: beforeunload
  window.addEventListener('beforeunload', onBeforeUnload);

  // Strategy 5: pagehide (mobile / bfcache)
  window.addEventListener('pagehide', onPageHide);

  // Focus recovery
  window.addEventListener('focus', onFocus);

  log.info('Autosave', 'Initialized', {
    periodMs: PERIODIC_INTERVAL_MS,
    idleMs: IDLE_TIMEOUT_MS,
  });

  return () => {
    if (_periodicTimer) { clearInterval(_periodicTimer); _periodicTimer = null; }
    if (_idleTimer)     { clearTimeout(_idleTimer);     _idleTimer     = null; }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('focus', onFocus);
    _initialized = false;
    log.info('Autosave', 'Torn down');
  };
}

// ─── Health check ────────────────────────────────────────────────────────────

export function getAutosaveStatus() {
  return {
    initialized: _initialized,
    lastSaveAt:  _lastSaveAt,
    lastSaveAgo: _lastSaveAt ? Date.now() - _lastSaveAt : null,
    dirtyCount:  _dirtyCount,
  };
}
