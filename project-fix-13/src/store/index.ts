// Store exports
export { useUIStore } from './uiStore';
export { useProjectStore } from './projectStore';
export { useEditorStore } from './editorStore';
export { useChatStore } from './chatStore';
export { useTerminalStore } from './terminalStore';
export { useAIStore } from './aiStore';

// Selectors
export * from './selectors';

// Types
export type { FileNode, Project } from './types';
export type { ChatMessage } from './chatStore';
export type { TerminalLine, TerminalLineType } from './terminalStore';
export type { SidePanel, AppView } from './uiStore';

// Utils
export { getLanguage, findFirstFile, getDefaultFiles } from './projectUtils';

// Persistence
export { scheduleSave, loadProjectsSync, loadProjectsAsync } from './persistence';

// Autosave
export { initAutosave } from './autosave';

// Backward-compat facade (for migration period — prefer individual stores)
export { useStore, getProjectState, getEditorState, getChatState, getTerminalState, getUIState } from './useStore';
