/**
 * AI Service — Unified interface for both mock and real LLM responses
 * Falls back to intelligent mock when no API key is configured
 */

import { ChatMessage, FileNode } from '../store/useStore';
import { flattenFileTree } from '../store/editorStore';
import { useAIStore } from '../store/aiStore';
import { streamAgentResponse, parseFileChanges } from '../core/agents';
import type { AgentContext, FileChange } from '../core/agents/types';
import { generateId } from './../shared/utils/id';
import { getMockResponse } from './aiMocks';


const USE_MOCK_AI = import.meta.env.VITE_MOCK_AI === 'true';

function uid() { return generateId(); }


// ─── Build agent context from current state ───
function buildContext(userMessage: string, files: FileNode[], activeFile: FileNode | null, history: ChatMessage[]): AgentContext {
  return {
    projectFiles: flattenFileTree(files),
    activeFile: activeFile ? { path: activeFile.path, content: activeFile.content || '', language: activeFile.language || '' } : undefined,
    conversationHistory: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    userRequest: userMessage,
  };
}

// ─── Streaming AI Response (Real LLM) ───
export async function* streamAIResponse(
  userMessage: string,
  files: FileNode[],
  activeFile: FileNode | null,
  history: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'file_changes' | 'thinking' | 'error' | 'done'; content?: string; fileChanges?: FileChange[] }> {
  const { config, isReadyToChat } = useAIStore.getState();
  const isConfigured = isReadyToChat();

  if (!isConfigured) {
    // Fallback to mock
    const response = await getMockResponse(userMessage, files, activeFile);
    // Simulate streaming by yielding char by char
    for (let i = 0; i < response.length; i += 3) {
      yield { type: 'text', content: response.slice(i, i + 3) };
      await new Promise(r => setTimeout(r, 8));
    }
    const fc = parseFileChanges(response);
    if (fc.length > 0) yield { type: 'file_changes', fileChanges: fc };
    yield { type: 'done' };
    return;
  }

  const ctx = buildContext(userMessage, files, activeFile, history);

  for await (const action of streamAgentResponse(ctx, config, signal)) {
    switch (action.type) {
      case 'thinking':
        yield { type: 'thinking', content: action.thinking };
        break;
      case 'message':
        yield { type: 'text', content: action.message };
        break;
      case 'file_change':
        yield { type: 'file_changes', fileChanges: action.fileChanges };
        break;
      case 'error':
        yield { type: 'error', content: action.message };
        break;
      case 'complete':
        yield { type: 'done' };
        break;
    }
  }
}

// ─── Legacy non-streaming interface (for compatibility) ───
export async function processAIMessage(
  userMessage: string,
  files: FileNode[],
  activeFile: FileNode | null
): Promise<ChatMessage> {
  const { config, isReadyToChat: _isReady } = useAIStore.getState();

  let content: string;
  if (!_isReady()) {
    content = await getMockResponse(userMessage, files, activeFile);
  } else {
    const { agentChat } = await import('../core/agents');
    const ctx = buildContext(userMessage, files, activeFile, []);
    const result = await agentChat(ctx, config);
    content = result.content;
  }

  return {
    id: uid(),
    role: 'assistant',
    content,
    timestamp: Date.now(),
    codeBlocks: [],
  };
}
