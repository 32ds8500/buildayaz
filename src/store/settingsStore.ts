import { create } from 'zustand';

export interface SettingsState {
  theme: 'dark' | 'light';
  autosaveEnabled: boolean;
  setTheme: (theme: 'dark' | 'light') => void;
  setAutosaveEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  autosaveEnabled: true,
  setTheme: (theme) => set({ theme }),
  setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
}));
