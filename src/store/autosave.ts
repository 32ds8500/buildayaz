/**
 * Autosave System — production-grade
 * Strategies: debounced write, periodic flush, visibilitychange, beforeunload
 */

import { scheduleSave } from './persistence';
import { getProjectState } from './useStore';
import { logger } from '../core/llm/logging/logger';

const log = logger.forModule('Autosave');

const PERIODIC_INTERVAL_MS = 30_000;

let _periodicTimer: ReturnType<typeof setInterval> | null = null;
let _initialized = false;

function flush(immediate: boolean, reason: string) {
  const projects = getProjectState().projects;
  if (!projects.length) return;
  log.debug(`Autosave triggered: ${reason}`, { count: projects.length, immediate });
  scheduleSave(projects, immediate);
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flush(true, 'visibilitychange:hidden');
}

function onBeforeUnload() {
  flush(true, 'beforeunload');
}

export function initAutosave(): () => void {
  if (_initialized) return () => {};
  _initialized = true;

  _periodicTimer = setInterval(() => flush(false, 'periodic'), PERIODIC_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);

  log.info('Initialized', { intervalMs: PERIODIC_INTERVAL_MS });

  return () => {
    if (_periodicTimer) clearInterval(_periodicTimer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
    _initialized = false;
    log.info('Torn down');
  };
}
