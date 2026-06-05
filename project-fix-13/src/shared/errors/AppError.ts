/**
 * Centralised error model
 * Replaces silent catch(() => {}) patterns
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';
export type ErrorCategory =
  | 'NETWORK'
  | 'AI_PROVIDER'
  | 'STORAGE'
  | 'VALIDATION'
  | 'PERMISSION'
  | 'UNKNOWN';

export interface AppErrorShape {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(shape: AppErrorShape) {
    super(shape.message);
    this.name = 'AppError';
    this.code = shape.code;
    this.category = shape.category;
    this.severity = shape.severity;
    this.retryable = shape.retryable;
    this.context = shape.context;
    this.cause = shape.cause;
  }

  static from(err: unknown, defaults?: Partial<AppErrorShape>): AppError {
    if (err instanceof AppError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new AppError({
      code: defaults?.code ?? 'UNKNOWN',
      message,
      category: defaults?.category ?? 'UNKNOWN',
      severity: defaults?.severity ?? 'error',
      retryable: defaults?.retryable ?? false,
      cause: err,
    });
  }

  toJSON(): AppErrorShape {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      context: this.context,
    };
  }
}
