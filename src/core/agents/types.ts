import type { LLMRole } from '../llm/types';
export interface AgentContext {
  projectFiles: { path: string; content: string; language: string }[];
  activeFile?: { path: string; content: string; language: string };
  conversationHistory: { role: LLMRole; content: string }[];
  userRequest: string;
}

export type FileChange = {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content: string;
};

export type AgentAction =
  | { type: 'thinking'; thinking: string }
  | { type: 'message'; message: string }
  | { type: 'file_change'; fileChanges: FileChange[] }
  | { type: 'error'; message: string }
  | { type: 'complete'; message: string };
