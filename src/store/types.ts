/**
 * Shared store types — imported by both useStore and persistence
 * to avoid circular dependencies.
 */

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  files: FileNode[];
  createdAt: number;
}
