/**
 * Application Logger — structured, production-safe
 * Wraps the LLM logger for app-wide usage
 */

import { logger as llmLogger } from '../../core/llm/logging/logger';
export type { LogLevel, LogEntry } from '../../core/llm/logging/logger';

// Re-export LLM logger as the app-wide logger
export const logger = llmLogger;

// Convenience shortcuts
export const log = {
  debug: (module: string, msg: string, data?: Record<string, unknown>) =>
    logger.debug(module, msg, data),
  info: (module: string, msg: string, data?: Record<string, unknown>) =>
    logger.info(module, msg, data),
  warn: (module: string, msg: string, data?: Record<string, unknown>) =>
    logger.warn(module, msg, data),
  error: (module: string, msg: string, data?: Record<string, unknown>) =>
    logger.error(module, msg, data),
};

/** Log an error with full context extraction */
export function logError(module: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(module, message, { ...context, stack });
}
