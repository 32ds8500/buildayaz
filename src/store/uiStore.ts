/**
 * UI Store — layout state only
 * Split from monolithic useStore for performance isolation
 */
import { create } from 'zustand';

export type SidePanel = 'files' | 'search' | 'git' | 'extensions' | 'diagnostics' | 'tasks';
export type AppView  = 'landing' | 'workspace';

interface UIState {
  view: AppView;
  sidebarOpen: boolean;
  chatOpen: boolean;
  terminalOpen: boolean;
  previewOpen: boolean;
  activePanel: SidePanel;
  mobileMenuOpen: boolean;

  setView: (v: AppView) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  toggleTerminal: () => void;
  togglePreview: () => void;
  setActivePanel: (p: SidePanel) => void;
  toggleMobileMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'landing',
  sidebarOpen: true,
  chatOpen: true,
  terminalOpen: false,
  previewOpen: false,
  activePanel: 'files',
  mobileMenuOpen: false,

  setView: (view) => set({ view }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set(s => ({ chatOpen: !s.chatOpen })),
  toggleTerminal: () => set(s => ({ terminalOpen: !s.terminalOpen })),
  togglePreview: () => set(s => ({ previewOpen: !s.previewOpen })),
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleMobileMenu: () => set(s => ({ mobileMenuOpen: !s.mobileMenuOpen })),
}));
