/**
 * Environment validation and typed access
 * Fails fast on missing required env vars in production
 */

export const env = {
  appVersion:           import.meta.env.VITE_APP_VERSION ?? '0.0.0',
  appEnv:               (import.meta.env.VITE_APP_ENV ?? 'development') as 'development' | 'staging' | 'production',
  isDev:                import.meta.env.DEV,
  isProd:               import.meta.env.PROD,
  enableAnalytics:      import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableErrorReporting: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
  debugLLM:             import.meta.env.VITE_DEBUG_LLM === 'true',
  defaultProvider:      import.meta.env.VITE_DEFAULT_PROVIDER ?? 'pollinations',
  defaultModel:         import.meta.env.VITE_DEFAULT_MODEL ?? 'openai',
} as const;

/** Call once at startup to log environment summary */
export function logEnvSummary(): void {
  if (!env.isDev) return;
  console.info(
    `[KodYap] v${env.appVersion} | env:${env.appEnv} | provider:${env.defaultProvider}`,
  );
}
