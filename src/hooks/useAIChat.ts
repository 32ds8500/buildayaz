/**
 * useAIChat — Custom hook for AI streaming chat
 * Extracted from ChatPanel for separation of concerns
 */

import { useCallback, useRef } from 'react';
import type { FileNode } from '../store/types';
import type { ChatMessage } from '../store/chatStore';
import { useChatStore } from '../store/chatStore';
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import { useAIStore } from '../store/aiStore';
import { streamAIResponse } from '../services/aiService';
import { sanitizePath } from '../shared/utils/sanitize';
import { generateId } from '../shared/utils/id';
import { getLanguage } from '../store/projectUtils';
import toast from 'react-hot-toast';

export interface UseAIChatReturn {
  sendMessage: (input: string) => Promise<void>;
  cancelStream: () => void;
}

export function useAIChat(): UseAIChatReturn {
  const { addMessage, updateMessage, setLoading, isLoading } = useChatStore();
  const { currentProject, updateFileContent, addFile } = useProjectStore();
  const { activeFile } = useEditorStore();
  const { cancelStream: cancelAI } = useAIStore();
  const abortRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    cancelAI();
  }, [setLoading, cancelAI]);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    const msg = input.trim();
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: msg,
      timestamp: Date.now(),
    };

    addMessage(userMsg);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    useAIStore.getState().setStreaming(true, controller);

    const assistantId = generateId();
    let fullContent = '';

    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    });

    try {
      for await (const chunk of streamAIResponse(
        msg,
        currentProject?.files ?? [],
        activeFile,
        useChatStore.getState().messages,
        controller.signal
      )) {
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
          updateMessage(assistantId, { content: fullContent });
        }

        if (chunk.type === 'file_changes' && chunk.fileChanges) {
          const BLOCKED = [/\.\./,/^\/etc\//,/^\/proc\//,/^\/sys\//,/^\/dev\//,/node_modules\//];
          for (const fc of chunk.fileChanges) {
            if (!fc.content || !currentProject) continue;
            const safePath = sanitizePath(fc.path);
            if (!safePath) { toast.error(`Güvensiz yol: ${fc.path}`); continue; }
            if (BLOCKED.some(re => re.test(safePath))) { toast.error(`Engellendi: ${fc.path}`); continue; }

            const { files } = currentProject;
            const exists = findFileInTree(files, safePath);

            if (exists) {
              updateFileContent(safePath, fc.content);
              toast.success(`📝 ${safePath.split('/').pop()} güncellendi`);
            } else {
              const parts = safePath.split('/');
              const fileName = parts.pop() ?? '';
              const parentPath = parts.join('/') || '/src';
              addFile(parentPath, {
                name: fileName,
                path: safePath,
                type: 'file',
                content: fc.content,
                language: getLanguage(fileName),
              });
              toast.success(`✨ ${fileName} oluşturuldu`);
            }
          }
        }

        if (chunk.type === 'error') {
          updateMessage(assistantId, { content: `❌ Hata: ${chunk.content}`, isStreaming: false });
          break;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const msg = err.message;
        updateMessage(assistantId, { content: `❌ ${msg}`, isStreaming: false });
      }
    } finally {
      updateMessage(assistantId, { isStreaming: false });
      setLoading(false);
      abortRef.current = null;
      useAIStore.getState().setStreaming(false);
    }
  }, [isLoading, addMessage, updateMessage, setLoading, currentProject, activeFile, updateFileContent, addFile]);

  return { sendMessage, cancelStream };
}

function findFileInTree(files: FileNode[], path: string): FileNode | null {
  for (const f of files) {
    if (f.path === path) return f;
    if (f.children) {
      const found = findFileInTree(f.children, path);
      if (found) return found;
    }
  }
  return null;
}
