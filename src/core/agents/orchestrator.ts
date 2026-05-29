/**
 * Agent Orchestrator — bridges aiService with LLM registry
 * Uses resilientStream / chatWithFallback for production reliability
 */

import {
  resilientStream,
  streamWithFallback,
  trimMessagesToContext,
  getModelInfo,
} from '../llm';
import type { LLMConfig, LLMMessage, LLMStreamChunk, LLMRequest } from '../llm';
import type { AgentContext, AgentAction, FileChange } from './types';
import { logger } from '../llm/logging/logger';

const log = logger.forModule('Orchestrator');

// ─── Path sanitisation ────────────────────────────────────────────
const ALLOWED_PATH_PREFIXES = ['/', './'];
const BLOCKED_PATH_PATTERNS = [
  /\.\./,
  /^\/etc\//,
  /^\/proc\//,
  /^\/sys\//,
  /^\/dev\//,
  /node_modules\//,
];

function sanitizePath(raw: string): string | null {
  const p = raw.trim().replace(/\\/g, '/');
  if (!ALLOWED_PATH_PREFIXES.some(pfx => p.startsWith(pfx))) return null;
  if (BLOCKED_PATH_PATTERNS.some(re => re.test(p))) return null;
  if (p.length > 260) return null;
  return p;
}

// ─── File change parser (multi-format) ───────────────────────────

/**
 * Supports:
 *   ```tsx // filepath: /src/Foo.tsx
 *   ```tsx /* filepath: /src/Foo.tsx *\/
 *   ```tsx // file: /src/Foo.tsx
 *   // filepath: /src/Foo.tsx  (line before fence)
 */
export function parseFileChanges(content: string): FileChange[] {
  const changes: FileChange[] = [];
  const seen = new Set<string>();

  // Strategy 1: filepath inside opening fence line
  const FENCE_RE = /^```(\w*)[^\n]*?(?:\/\/|\/\*)\s*(?:filepath|file|path)\s*:\s*([^\n*`]+?)(?:\s*\*\/)?\s*\n([\s\S]*?)^```/gm;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(content)) !== null) {
    const path = sanitizePath(m[2]);
    const code = m[3].trimEnd();
    if (path && code && !seen.has(path)) {
      seen.add(path);
      changes.push({ path, action: 'create', content: code });
    }
  }

  // Strategy 2: filepath comment on the line before fence
  const PRE_FENCE_RE = /(?:\/\/|#)\s*(?:filepath|file|path)\s*:\s*([^\n]+)\n```(\w*)\n([\s\S]*?)```/gm;
  while ((m = PRE_FENCE_RE.exec(content)) !== null) {
    const path = sanitizePath(m[1]);
    const code = m[3].trimEnd();
    if (path && code && !seen.has(path)) {
      seen.add(path);
      changes.push({ path, action: 'create', content: code });
    }
  }

  return changes;
}

// ─── System prompt builder ────────────────────────────────────────

function buildSystemPrompt(ctx: AgentContext): string {
  const fileList = ctx.projectFiles
    .slice(0, 30)
    .map(f => `  ${f.path} (${f.language})`)
    .join('\n');

  const activeInfo = ctx.activeFile
    ? `\nAktif dosya: ${ctx.activeFile.path}\n\`\`\`${ctx.activeFile.language}\n${ctx.activeFile.content.slice(0, 2000)}\n\`\`\``
    : '';

  return `Sen KodYap IDE'nin AI asistanısın. Türkçe yanıt ver.

Proje dosyaları:
${fileList || '  (boş proje)'}
${activeInfo}

Dosya değişikliği formatı (şu şekilde kullan):
\`\`\`tsx // filepath: /src/components/MyComponent.tsx
// kod buraya
\`\`\`

Kurallar:
- Tam, çalışır kod yaz. Placeholder bırakma.
- Mevcut dosyaları düzenlerken tam içerik ver.
- Yeni bağımlılık gerekiyorsa npm install komutunu belirt.
- Her zaman Türkçe açıkla, kod İngilizce olabilir.`;
}

// ─── Stream agent response ────────────────────────────────────────

export async function* streamAgentResponse(
  ctx: AgentContext,
  config: LLMConfig,
  signal?: AbortSignal,
): AsyncGenerator<AgentAction> {
  const modelInfo = getModelInfo(config.provider, config.model);
  const contextWindow = modelInfo?.contextWindow ?? 32000;

  const systemMsg: LLMMessage = { role: 'system', content: buildSystemPrompt(ctx) };

  const rawHistory: LLMMessage[] = ctx.conversationHistory.map(h => ({
    role: h.role as 'user' | 'assistant',
    content: h.content,
  }));

  const userMsg: LLMMessage = { role: 'user', content: ctx.userRequest };

  const allMsgs = [systemMsg, ...rawHistory, userMsg];
  const trimmed = trimMessagesToContext(allMsgs, contextWindow, modelInfo?.maxOutputTokens ?? 1024);

  const request: LLMRequest = {
    messages: trimmed,
    config: { ...config, apiKey: config.apiKey },
    signal,
    requestId: `agent_${Date.now()}`,
  };

  let fullContent = '';
  let usedFallback: string | undefined;

  try {
    // Use fallback-aware stream
    const streamGen = (config.provider === 'pollinations' || !config.apiKey)
      ? streamWithFallback(request)
      : resilientStream(request);

    for await (const chunk of streamGen) {
      if (signal?.aborted) break;

      const c = chunk as LLMStreamChunk & { usedFallback?: string };
      if (c.usedFallback) usedFallback = c.usedFallback;

      switch (c.type) {
        case 'text':
          fullContent += c.content || '';
          yield { type: 'message', message: c.content || '' };
          break;
        case 'reasoning':
          yield { type: 'thinking', thinking: c.content || '' };
          break;
        case 'usage':
          if (c.usage) {
            log.debug('Token usage', { tokens: c.usage.totalTokens, fallback: usedFallback });
          }
          break;
        case 'error':
          yield { type: 'error', message: c.error || 'Bilinmeyen hata' };
          return;
        case 'done':
          break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Stream failed', { error: msg });
    yield { type: 'error', message: `İstek başarısız: ${msg}` };
    return;
  }

  // Parse file changes from accumulated content
  if (fullContent) {
    const rawChanges = parseFileChanges(fullContent);
    if (rawChanges.length > 0) {
      const existingPaths = new Set(ctx.projectFiles.map(f => f.path));
      const fileChanges = rawChanges.map(fc => ({
        ...fc,
        action: (existingPaths.has(fc.path) ? 'edit' : 'create') as 'create' | 'edit',
      }));
      yield { type: 'file_change', fileChanges };
    }
  }

  yield { type: 'complete', message: usedFallback ? `(${usedFallback} ile tamamlandı)` : '' };
}

// ─── Non-streaming agent chat ─────────────────────────────────────

export async function agentChat(
  ctx: AgentContext,
  config: LLMConfig,
  signal?: AbortSignal,
): Promise<{ content: string; fileChanges: FileChange[] }> {
  let content = '';
  let fileChanges: FileChange[] = [];

  for await (const action of streamAgentResponse(ctx, config, signal)) {
    if (action.type === 'message') content += action.message;
    if (action.type === 'file_change') fileChanges = action.fileChanges;
    if (action.type === 'error') throw new Error(action.message);
  }

  return { content, fileChanges };
}
