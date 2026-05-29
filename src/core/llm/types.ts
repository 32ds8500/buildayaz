/**
 * Production LLM Type System — v2
 * Principal-grade type definitions for multi-provider AI architecture
 * Supports: free/open-source providers, streaming, fallbacks, circuit breakers
 */

// ─────────────────────── Provider Registry ───────────────────────

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'together'
  | 'deepinfra'
  | 'cloudflare'
  | 'huggingface'
  | 'pollinations'
  | 'ollama'
  | 'custom';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export type ModelTier = 'free' | 'standard' | 'premium' | 'reasoning' | 'local';

// ─────────────────────── Capabilities ───────────────────────

export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  jsonMode: boolean;
  reasoning: boolean;
  imageGeneration: boolean;
  embeddings: boolean;
  freeAccess: boolean;       // true = no billing required
  requiresApiKey: boolean;   // false = anonymous use OK (e.g. Pollinations)
  localOnly: boolean;        // true = runs on device (Ollama, GGUF)
}

// ─────────────────────── Model Registry ───────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  costPer1kInput?: number;    // 0 = free
  costPer1kOutput?: number;   // 0 = free
  tier: ModelTier;
  isFree: boolean;            // explicit free flag
  description?: string;
  deprecated?: boolean;
}

// ─────────────────────── Error Handling ───────────────────────

export interface LLMErrorShape {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
  status?: number;
  raw?: unknown;
}

export class LLMError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly raw?: unknown;

  constructor(shape: LLMErrorShape) {
    super(shape.message);
    this.name = 'LLMError';
    this.code = shape.code;
    this.provider = shape.provider;
    this.retryable = shape.retryable;
    this.status = shape.status;
    this.raw = shape.raw;
  }

  toShape(): LLMErrorShape {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      status: this.status,
    };
  }

  static fromHttpStatus(status: number, body: string, provider: string): LLMError {
    let message = body;
    let code = 'UNKNOWN';
    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || parsed.message || parsed.detail || body;
      code = parsed.error?.code || parsed.error?.type || 'API_ERROR';
    } catch { /* use raw body */ }

    const retryable = [429, 500, 502, 503, 504, 529].includes(status);
    return new LLMError({ code, message, provider, retryable, status });
  }
}

// ─────────────────────── Messages ───────────────────────

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  images?: string[];  // base64 or URL
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

// ─────────────────────── Config ───────────────────────

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  responseFormat?: LLMResponseFormat;
  seed?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  // Provider-specific extensions
  extra?: Record<string, unknown>;
}

export interface LLMResponseFormat {
  type: 'text' | 'json_schema';
  schema?: unknown;
}

// ─────────────────────── Request / Response ───────────────────────

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  config: LLMConfig;
  signal?: AbortSignal;
  responseFormat?: LLMResponseFormat;
  retryCount?: number;
  requestId?: string;    // for deduplication & tracing
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: LLMProvider;
  finishReason: string;
  latencyMs?: number;
  requestId?: string;
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_delta' | 'reasoning' | 'usage' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  toolCallDelta?: {
    index: number;
    id?: string;
    functionName?: string;
    argumentsDelta?: string;
  };
  usage?: TokenUsage;
  error?: string;
}

// ─────────────────────── Provider Interface ───────────────────────

export interface ILLMProvider {
  readonly name: LLMProvider;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  chat(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk>;
  getModels(): ModelInfo[];
  validateConfig(config: LLMConfig): LLMErrorShape | null;
  healthCheck?(config: LLMConfig): Promise<boolean>;
}

// ─────────────────────── Retry Config ───────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
  jitterMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504, 529],
  jitterMs: 500,
};

// ─────────────────────── Circuit Breaker ───────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;     // failures before opening
  successThreshold: number;     // successes to close from half-open
  timeoutMs: number;            // how long to stay open
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60_000,
};

// ─────────────────────── Health / Monitoring ───────────────────────

export interface ProviderHealth {
  provider: LLMProvider;
  status: 'healthy' | 'degraded' | 'down';
  circuitState: CircuitState;
  failureCount: number;
  successCount: number;
  avgLatencyMs: number;
  lastChecked: number;
  lastError?: string;
}

export interface RequestTrace {
  requestId: string;
  provider: LLMProvider;
  model: string;
  startedAt: number;
  endedAt?: number;
  latencyMs?: number;
  tokensUsed?: number;
  status: 'pending' | 'success' | 'error' | 'timeout';
  error?: string;
  fallbackUsed?: LLMProvider;
}

// ─────────────────────── Fallback Config ───────────────────────

export interface FallbackChain {
  primary: LLMProvider;
  fallbacks: LLMProvider[];
  conditions: {
    onRateLimit: boolean;
    onError: boolean;
    onTimeout: boolean;
    onCircuitOpen: boolean;
  };
}
