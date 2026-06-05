/**
 * Structured Logger — production-safe, debug-mode aware
 * Never logs API keys or sensitive data
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const REDACTED_KEYS = new Set(['apikey', 'api_key', 'key', 'token', 'authorization', 'password', 'secret']);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? '***' : redact(v, depth + 1);
  }
  return out;
}

class Logger {
  private _debug = false;
  private _buffer: LogEntry[] = [];
  private readonly MAX_BUFFER = 500;
  private _subscribers: ((entry: LogEntry) => void)[] = [];

  enableDebug(v: boolean) { this._debug = v; }

  subscribe(fn: (e: LogEntry) => void): () => void {
    this._subscribers.push(fn);
    return () => { this._subscribers = this._subscribers.filter(s => s !== fn); };
  }

  private emit(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
    if (level === 'debug' && !this._debug) return;
    const entry: LogEntry = {
      level, module, message,
      data: data ? redact(data) as Record<string, unknown> : undefined,
      timestamp: Date.now(),
    };
    this._buffer.push(entry);
    if (this._buffer.length > this.MAX_BUFFER) this._buffer.shift();
    const prefix = `[LLM:${module}]`;
    switch (level) {
      case 'debug': console.debug(prefix, message, entry.data ?? ''); break;
      case 'info':  console.info(prefix, message, entry.data ?? ''); break;
      case 'warn':  console.warn(prefix, message, entry.data ?? ''); break;
      case 'error': console.error(prefix, message, entry.data ?? ''); break;
    }
    for (const s of this._subscribers) {
      try { s(entry); } catch { /* never throw from logger */ }
    }
  }

  debug(module: string, msg: string, data?: Record<string, unknown>) { this.emit('debug', module, msg, data); }
  info(module: string, msg: string, data?: Record<string, unknown>)  { this.emit('info',  module, msg, data); }
  warn(module: string, msg: string, data?: Record<string, unknown>)  { this.emit('warn',  module, msg, data); }
  error(module: string, msg: string, data?: Record<string, unknown>) { this.emit('error', module, msg, data); }

  getLogs(level?: LogLevel): LogEntry[] {
    return level ? this._buffer.filter(e => e.level === level) : [...this._buffer];
  }

  forModule(mod: string) {
    return {
      debug: (msg: string, data?: Record<string, unknown>) => this.debug(mod, msg, data),
      info:  (msg: string, data?: Record<string, unknown>) => this.info(mod, msg, data),
      warn:  (msg: string, data?: Record<string, unknown>) => this.warn(mod, msg, data),
      error: (msg: string, data?: Record<string, unknown>) => this.error(mod, msg, data),
    };
  }
}

export const logger = new Logger();
