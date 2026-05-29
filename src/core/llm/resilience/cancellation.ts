/**
 * Cancellation Management
 * Proper propagation of AbortSignal through request lifecycle
 * Ensures cleanup and resource release on cancellation
 */

import { logger } from '../logging/logger';
import type { CancellationContext } from './types';

const log = logger.forModule('Cancellation');

export interface CancellableOperation<T> {
  promise: Promise<T>;
  cancel: (reason?: string) => void;
  isAborted: () => boolean;
}

class CancellationManager {
  private contexts = new Map<string, CancellationContext>();
  private cleanupHandlers = new Map<string, Array<() => void>>();

  createContext(timeout?: number): CancellationContext {
    const controller = new AbortController();
    const signal = controller.signal;
    let timeoutHandle: number | undefined;

    if (timeout && timeout > 0) {
      timeoutHandle = window.setTimeout(() => {
        controller.abort();
        log.warn(`Request cancelled due to timeout: ${timeout}ms`);
      }, timeout);
    }

    return {
      signal,
      controller,
      timeoutHandle,
    };
  }

  registerContext(id: string, context: CancellationContext): void {
    this.contexts.set(id, context);
    this.cleanupHandlers.set(id, []);
  }

  registerCleanup(id: string, handler: () => void): void {
    const handlers = this.cleanupHandlers.get(id) ?? [];
    handlers.push(handler);
    this.cleanupHandlers.set(id, handlers);
  }

  cancel(id: string, reason?: string): void {
    const ctx = this.contexts.get(id);
    if (!ctx) return;

    log.info(`Cancelling request ${id}: ${reason ?? 'no reason'}`);

    if (ctx.timeoutHandle) {
      clearTimeout(ctx.timeoutHandle);
    }

    ctx.controller.abort();
    this.cleanup(id);
  }

  cleanup(id: string): void {
    const handlers = this.cleanupHandlers.get(id) ?? [];
    for (const handler of handlers) {
      try {
        handler();
      } catch (err) {
        log.error(`Cleanup handler error: ${err}`);
      }
    }

    this.contexts.delete(id);
    this.cleanupHandlers.delete(id);
  }

  isAborted(id: string): boolean {
    return this.contexts.get(id)?.signal.aborted ?? true;
  }

  /**
   * Wrap a promise with cancellation support
   */
  cancellable<T>(
    id: string,
    promise: Promise<T>,
    timeout?: number,
  ): CancellableOperation<T> {
    const ctx = this.createContext(timeout);
    this.registerContext(id, ctx);

    const wrappedPromise = Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        ctx.signal.addEventListener('abort', () => {
          reject(new Error('Operation cancelled'));
        });
      }),
    ]);

    return {
      promise: wrappedPromise,
      cancel: (reason?: string) => this.cancel(id, reason),
      isAborted: () => this.isAborted(id),
    };
  }

  /**
   * Chain multiple AbortSignals
   */
  chainSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);

    for (const signal of validSignals) {
      if (signal.aborted) {
        controller.abort();
        return controller.signal;
      }

      signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    return controller.signal;
  }
}

export const cancellationManager = new CancellationManager();
