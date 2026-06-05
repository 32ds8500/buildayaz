/**
 * LLM Configuration Constants
 * Centralised timeouts, retry configs, model defaults
 */

export const LLM_CONSTANTS = {
  REQUEST_TIMEOUT_MS:       60_000,
  STREAM_TIMEOUT_MS:        120_000,
  HEALTH_CHECK_TIMEOUT_MS:  3_000,
  MAX_RETRIES:              3,
  BASE_DELAY_MS:            1_000,
  MAX_DELAY_MS:             30_000,
  JITTER_MS:                500,
  RETRYABLE_STATUSES:       [429, 500, 502, 503, 504, 529] as number[],
  CIRCUIT_FAILURE_THRESHOLD:5,
  CIRCUIT_SUCCESS_THRESHOLD:2,
  CIRCUIT_TIMEOUT_MS:       60_000,
  DEFAULT_TEMPERATURE:      0.7,
  DEFAULT_MAX_TOKENS:       4096,
  FREE_FALLBACK_CHAIN: [
    'pollinations', 'ollama', 'gemini', 'groq', 'openrouter', 'together', 'huggingface',
  ] as const,
} as const;
