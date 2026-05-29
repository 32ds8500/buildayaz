export interface SSEParseResult { events: string[]; remaining: string; }

export function parseSSE(buffer: string): SSEParseResult {
  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';
  const events: string[] = [];
  for (const line of lines) {
    const t = line.trimEnd();
    if (t.startsWith('data: ')) events.push(t.slice(6));
  }
  return { events, remaining };
}

export async function* streamSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseSSE(buffer);
      buffer = remaining;
      for (const ev of events) yield ev;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
