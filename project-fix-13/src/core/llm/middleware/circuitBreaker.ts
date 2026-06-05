/**
 * Circuit Breaker — prevents cascading failures across providers
 * States: closed (normal) → open (failing) → half-open (testing recovery)
 */
import type { CircuitBreakerConfig, CircuitState, ProviderHealth } from '../types';
import { DEFAULT_CIRCUIT_CONFIG } from '../types';
import { logger } from '../logging/logger';
import type { LLMProvider } from '../types';

const log = logger.forModule('CircuitBreaker');

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number;
  lastError: string;
  latencies: number[];     // rolling window
}

class CircuitBreakerRegistry {
  private readonly circuits = new Map<string, CircuitEntry>();
  private readonly cfg: CircuitBreakerConfig;

  constructor(cfg: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG) {
    this.cfg = cfg;
  }

  private key(provider: LLMProvider, model?: string) {
    return model ? `${provider}:${model}` : provider;
  }

  private get(provider: LLMProvider, model?: string): CircuitEntry {
    const k = this.key(provider, model);
    if (!this.circuits.has(k)) {
      this.circuits.set(k, {
        state: 'closed', failures: 0, successes: 0,
        openedAt: 0, lastError: '', latencies: [],
      });
    }
    return this.circuits.get(k)!;
  }

  isOpen(provider: LLMProvider, model?: string): boolean {
    const c = this.get(provider, model);
    if (c.state === 'closed') return false;
    if (c.state === 'open') {
      const elapsed = Date.now() - c.openedAt;
      if (elapsed >= this.cfg.timeoutMs) {
        c.state = 'half-open';
        c.successes = 0;
        log.info(provider, 'Circuit half-open — testing recovery');
      } else {
        return true;
      }
    }
    return false; // half-open: allow one request through
  }

  recordSuccess(provider: LLMProvider, latencyMs: number, model?: string) {
    const c = this.get(provider, model);
    c.latencies.push(latencyMs);
    if (c.latencies.length > 20) c.latencies.shift();

    if (c.state === 'half-open') {
      c.successes++;
      if (c.successes >= this.cfg.successThreshold) {
        c.state = 'closed';
        c.failures = 0;
        log.info(provider, 'Circuit closed — recovery confirmed');
      }
    } else {
      c.failures = Math.max(0, c.failures - 1); // decay failures on success
    }
  }

  recordFailure(provider: LLMProvider, error: string, model?: string) {
    const c = this.get(provider, model);
    c.failures++;
    c.lastError = error;

    if (c.state === 'half-open' || c.failures >= this.cfg.failureThreshold) {
      c.state = 'open';
      c.openedAt = Date.now();
      log.warn(provider, `Circuit OPEN after ${c.failures} failures`, { error });
    }
  }

  getHealth(provider: LLMProvider, model?: string): ProviderHealth {
    const c = this.get(provider, model);
    const latencies = c.latencies;
    const avg = latencies.length > 0
      ? latencies.reduce((s, v) => s + v, 0) / latencies.length
      : 0;

    return {
      provider,
      status: c.state === 'closed' ? 'healthy' : c.state === 'half-open' ? 'degraded' : 'down',
      circuitState: c.state,
      failureCount: c.failures,
      successCount: c.successes,
      avgLatencyMs: Math.round(avg),
      lastChecked: Date.now(),
      lastError: c.lastError || undefined,
    };
  }

  getAllHealth(): ProviderHealth[] {
    return [...this.circuits.keys()].map(k => {
      const [provider] = k.split(':') as [LLMProvider];
      return this.getHealth(provider);
    });
  }

  reset(provider: LLMProvider, model?: string) {
    const k = this.key(provider, model);
    this.circuits.delete(k);
    log.info(provider, 'Circuit manually reset');
  }
}

export const circuitBreaker = new CircuitBreakerRegistry();
