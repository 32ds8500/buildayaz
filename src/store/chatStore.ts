/**
 * Chat Store — messages, loading state
 */
import { create } from 'zustand';
import { generateId } from '../shared/utils/id';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;

  addMessage: (msg: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) => set(s => ({
    messages: [...s.messages, { ...msg, id: msg.id ?? generateId() }],
  })),

  updateMessage: (id, patch) => set(s => ({
    messages: s.messages.map(m => m.id === id ? { ...m, ...patch } : m),
  })),

  setLoading: (isLoading) => set({ isLoading }),
  clearMessages: () => set({ messages: [] }),
}));
