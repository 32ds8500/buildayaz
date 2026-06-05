/**
 * Terminal Store — isolated from project/editor state
 */
import { create } from 'zustand';
import { generateId } from '../shared/utils/id';

export type TerminalLineType = 'input' | 'output' | 'error' | 'success' | 'info';

export interface TerminalLine {
  id: string;
  text: string;
  type: TerminalLineType;
  timestamp: number;
}

interface TerminalState {
  lines: TerminalLine[];
  addLine: (line: Omit<TerminalLine, 'id'>) => void;
  clear: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  addLine: (line) => set(s => ({
    lines: [...s.lines, { ...line, id: generateId() }].slice(-2000), // cap at 2000
  })),
  clear: () => set({ lines: [] }),
}));
