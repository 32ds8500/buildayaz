/**
 * Editor Store — open files, active file, file tree mutations
 * Split from useStore for isolated subscriptions
 */
import { create } from 'zustand';
import type { FileNode } from './types';

// ─── File tree utilities (memoized, no JSON.stringify) ─────────────

function updateInTree(files: FileNode[], path: string, content: string): FileNode[] {
  return files.map(f => {
    if (f.path === path) return { ...f, content };
    if (f.children) return { ...f, children: updateInTree(f.children, path, content) };
    return f;
  });
}

function deleteFromTree(files: FileNode[], path: string): FileNode[] {
  return files
    .filter(f => f.path !== path)
    .map(f => f.children ? { ...f, children: deleteFromTree(f.children, path) } : f);
}

function renameInTree(files: FileNode[], path: string, newName: string, getLang: (n: string) => string): FileNode[] {
  return files.map(f => {
    if (f.path === path) {
      const parts = path.split('/');
      parts[parts.length - 1] = newName;
      return { ...f, name: newName, path: parts.join('/'), language: getLang(newName) };
    }
    if (f.children) return { ...f, children: renameInTree(f.children, path, newName, getLang) };
    return f;
  });
}

function addToTree(files: FileNode[], parentPath: string, file: FileNode): FileNode[] {
  if (!parentPath || parentPath === '/') return [...files, file];
  return files.map(f => {
    if (f.path === parentPath && f.type === 'folder') {
      return { ...f, children: [...(f.children ?? []), file] };
    }
    if (f.children) return { ...f, children: addToTree(f.children, parentPath, file) };
    return f;
  });
}

/** Flat list of all files (memoized externally via useMemo in consumers) */
export function flattenFileTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'file') result.push(node);
    if (node.children) stack.push(...node.children);
  }
  return result;
}

// ─── Store ────────────────────────────────────────────────────────

interface EditorState {
  openFiles: FileNode[];
  activeFile: FileNode | null;

  openFile: (file: FileNode) => void;
  closeFile: (path: string) => void;
  setActiveFile: (file: FileNode) => void;

  /**
   * These file-tree mutations receive the full updated tree from projectStore
   * via the project store's action, which calls editorStore to sync open files.
   */
  syncOpenFiles: (updatedTree: FileNode[]) => void;
  updateOpenFileContent: (path: string, content: string) => void;
  closeAll: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  activeFile: null,

  openFile: (file) => set(s => {
    const already = s.openFiles.find(f => f.path === file.path);
    return {
      openFiles: already ? s.openFiles : [...s.openFiles, file],
      activeFile: file,
    };
  }),

  closeFile: (path) => set(s => {
    const remaining = s.openFiles.filter(f => f.path !== path);
    const newActive = s.activeFile?.path === path
      ? (remaining[remaining.length - 1] ?? null)
      : s.activeFile;
    return { openFiles: remaining, activeFile: newActive };
  }),

  setActiveFile: (activeFile) => set({ activeFile }),

  syncOpenFiles: (updatedTree) => set(s => {
    const flat = flattenFileTree(updatedTree);
    const openFiles = s.openFiles
      .map(of => flat.find(f => f.path === of.path) ?? of)
      .filter(of => flat.some(f => f.path === of.path));
    const activeFile = s.activeFile
      ? (flat.find(f => f.path === s.activeFile!.path) ?? null)
      : null;
    return { openFiles, activeFile };
  }),

  updateOpenFileContent: (path, content) => set(s => ({
    openFiles: s.openFiles.map(f => f.path === path ? { ...f, content } : f),
    activeFile: s.activeFile?.path === path ? { ...s.activeFile, content } : s.activeFile,
  })),

  closeAll: () => set({ openFiles: [], activeFile: null }),
}));

// ─── Export tree utilities for projectStore use ────────────────────
export { updateInTree, deleteFromTree, renameInTree, addToTree };
