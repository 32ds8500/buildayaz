/**
 * Timeout wrapper — rejects after a given ms
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = 'request',
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    fn().then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
