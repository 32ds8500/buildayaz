/**
 * useStore — backward-compatible facade
 *
 * Combines uiStore + projectStore + editorStore + chatStore + terminalStore
 * into a single hook so existing components work without modification.
 *
 * New code should import from individual stores directly for better
 * re-render isolation.
 */

import { useUIStore } from './uiStore';
import { useProjectStore } from './projectStore';
import { useEditorStore } from './editorStore';
import { useChatStore } from './chatStore';
import { useTerminalStore } from './terminalStore';
import { useSettingsStore } from './settingsStore';

// Re-export types used across the codebase
export type { FileNode, Project } from './types';
export type { ChatMessage } from './chatStore';
export type { TerminalLine, TerminalLineType } from './terminalStore';
export type { SidePanel, AppView } from './uiStore';
export { getLanguage } from './projectUtils';

// Convenience facade — merges all stores into one object
// TODO: remove after full migration to domain stores

export const useStore = () => {
  if (import.meta.env.DEV) {
    console.warn("[DEPRECATED] useStore facade is deprecated. Use domain stores directly.");
  }
  const ui      = useUIStore();
  const project = useProjectStore();
  const editor  = useEditorStore();
  const chat    = useChatStore();
  const terminal = useTerminalStore();

  return {
    // ── UI ──
    view:           ui.view,
    sidebarOpen:    ui.sidebarOpen,
    chatOpen:       ui.chatOpen,
    terminalOpen:   ui.terminalOpen,
    previewOpen:    ui.previewOpen,
    activePanel:    ui.activePanel,
    mobileMenuOpen: ui.mobileMenuOpen,
    setView:        ui.setView,
    toggleSidebar:  ui.toggleSidebar,
    toggleChat:     ui.toggleChat,
    toggleTerminal: ui.toggleTerminal,
    togglePreview:  ui.togglePreview,
    setActivePanel: ui.setActivePanel,
    toggleMobileMenu: ui.toggleMobileMenu,

    // ── Project ──
    projects:          project.projects,
    currentProject:    project.currentProject,
    createProject:     project.createProject,
    setCurrentProject: project.setCurrentProject,
    deleteProject:     project.deleteProject,
    importProject:     project.importProject,
    updateFileContent: project.updateFileContent,
    addFile:           project.addFile,
    deleteFile:        project.deleteFile,
    renameFile:        project.renameFile,

    // ── Editor ──
    openFiles:   editor.openFiles,
    activeFile:  editor.activeFile,
    openFile:    editor.openFile,
    closeFile:   editor.closeFile,
    setActiveFile: editor.setActiveFile,

    // ── Chat ──
    chatMessages:    chat.messages,
    chatLoading:     chat.isLoading,
    addChatMessage:  (msg: Parameters<typeof chat.addMessage>[0]) => chat.addMessage(msg),
    updateChatMessage: chat.updateMessage,
    setChatLoading:  chat.setLoading,
    clearChat:       chat.clearMessages,

    // ── Terminal ──
    terminalLines:   terminal.lines,
    addTerminalLine: terminal.addLine,
    clearTerminal:   terminal.clear,
  };
};

// Direct store access (for services that can't use hooks)
export { useUIStore, useProjectStore, useEditorStore, useChatStore, useTerminalStore, useSettingsStore };

// Static getState for non-React contexts (services, effects)
export const getProjectState  = () => useProjectStore.getState();
export const getEditorState   = () => useEditorStore.getState();
export const getChatState     = () => useChatStore.getState();
export const getTerminalState = () => useTerminalStore.getState();
export const getUIState       = () => useUIStore.getState();
