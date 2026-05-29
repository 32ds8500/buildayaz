// Utilities
export { generateId, shortId }          from './utils/id';
export { deepEqual, shallowEqual }      from './utils/deepEqual';
export { escapeHtml, stripHtml, sanitizePath, sanitizeHtml } from './utils/sanitize';
export { env, logEnvSummary }           from './utils/env';

// Errors
export { AppError }                     from './errors/AppError';
export type { AppErrorShape, ErrorSeverity, ErrorCategory } from './errors/AppError';
