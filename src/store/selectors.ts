/**
 * Stable memoized selectors for Zustand stores
 *
 * Use these in components instead of raw destructuring to prevent
 * unnecessary re-renders when unrelated state changes.
 *
 * Example:
 *   const currentProject = useProjectStore(selectCurrentProject);
 *   // Only re-renders when currentProject reference changes
 */

import { useProjectStore } from './projectStore';
import { useEditorStore } from './editorStore';
import { useUIStore } from './uiStore';
import { useChatStore } from './chatStore';
import { useTerminalStore } from './terminalStore';
import type { Project, FileNode } from './types';
import type { ChatMessage } from './chatStore';
import type { TerminalLine } from './terminalStore';
import type { SidePanel, AppView } from './uiStore';

// ─── Project selectors ──────────────────────────────────────────

export const selectCurrentProject = (s: ReturnType<typeof useProjectStore.getState>): Project | null =>
  s.currentProject;

export const selectProjects = (s: ReturnType<typeof useProjectStore.getState>): Project[] =>
  s.projects;

export const selectProjectFiles = (s: ReturnType<typeof useProjectStore.getState>): FileNode[] =>
  s.currentProject?.files ?? [];

// ─── Editor selectors ───────────────────────────────────────────

export const selectActiveFile = (s: ReturnType<typeof useEditorStore.getState>): FileNode | null =>
  s.activeFile;

export const selectOpenFiles = (s: ReturnType<typeof useEditorStore.getState>): FileNode[] =>
  s.openFiles;

export const selectOpenFileCount = (s: ReturnType<typeof useEditorStore.getState>): number =>
  s.openFiles.length;

// ─── UI selectors ────────────────────────────────────────────────

export const selectView = (s: ReturnType<typeof useUIStore.getState>): AppView =>
  s.view;

export const selectSidebarOpen = (s: ReturnType<typeof useUIStore.getState>): boolean =>
  s.sidebarOpen;

export const selectActivePanel = (s: ReturnType<typeof useUIStore.getState>): SidePanel =>
  s.activePanel;

export const selectPanelVisibility = (s: ReturnType<typeof useUIStore.getState>) => ({
  sidebarOpen: s.sidebarOpen,
  chatOpen: s.chatOpen,
  terminalOpen: s.terminalOpen,
  previewOpen: s.previewOpen,
});

// ─── Chat selectors ──────────────────────────────────────────────

export const selectChatMessages = (s: ReturnType<typeof useChatStore.getState>): ChatMessage[] =>
  s.messages;

export const selectChatLoading = (s: ReturnType<typeof useChatStore.getState>): boolean =>
  s.isLoading;

export const selectChatMessageCount = (s: ReturnType<typeof useChatStore.getState>): number =>
  s.messages.length;

// ─── Terminal selectors ──────────────────────────────────────────

export const selectTerminalLines = (s: ReturnType<typeof useTerminalStore.getState>): TerminalLine[] =>
  s.lines;

// ─── Convenience hooks with stable selectors ────────────────────

/** Only re-renders when currentProject ID changes */
export function useCurrentProjectId(): string | null {
  return useProjectStore(s => s.currentProject?.id ?? null);
}

/** Only re-renders when project name changes */
export function useCurrentProjectName(): string | null {
  return useProjectStore(s => s.currentProject?.name ?? null);
}

/** Only re-renders when active file path changes */
export function useActiveFilePath(): string | null {
  return useEditorStore(s => s.activeFile?.path ?? null);
}

/** Only re-renders when active file content changes */
export function useActiveFileContent(): string {
  return useEditorStore(s => s.activeFile?.content ?? '');
}

/** Only re-renders when panel visibility combination changes */
export function usePanelVisibility() {
  return useUIStore(selectPanelVisibility);
}

/** Only re-renders when message count changes (not content) */
export function useChatMessageCount(): number {
  return useChatStore(selectChatMessageCount);
}
