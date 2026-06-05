/**
 * Project Store — projects, file tree, persistence
 * Single source of truth for project data
 */
import { create } from 'zustand';
import type { Project, FileNode } from './types';
import { scheduleSave, loadProjectsSync } from './persistence';
import { updateInTree, deleteFromTree, renameInTree, addToTree, useEditorStore } from './editorStore';
import { generateId } from '../shared/utils/id';
import { markDirty } from './autosave';
import { getLanguage, findFirstFile, getDefaultFiles } from './projectUtils';

// ─── Store ────────────────────────────────────────────────────────

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;

  createProject: (name: string, description: string, template: string) => void;
  setCurrentProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  importProject: (p: Project) => void;

  updateFileContent: (path: string, content: string) => void;
  addFile: (parentPath: string, file: FileNode) => void;
  deleteFile: (path: string) => void;
  renameFile: (path: string, newName: string) => void;
}

function persist(projects: Project[], immediate = false) {
  scheduleSave(projects, immediate);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: loadProjectsSync(),
  currentProject: null,

  createProject: (name, description, template) => {
    const files = getDefaultFiles(template);
    const project: Project = {
      id: generateId(),
      name,
      description,
      template,
      files,
      createdAt: Date.now(),
    };
    const projects = [...get().projects, project];
    persist(projects, true);
    const first = findFirstFile(files);
    set({ projects, currentProject: project });
    if (first) {
      useEditorStore.getState().openFile(first);
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project });
    const first = findFirstFile(project.files);
    if (first) useEditorStore.getState().openFile(first);
  },

  deleteProject: (id) => {
    const projects = get().projects.filter(p => p.id !== id);
    persist(projects, true);
    const current = get().currentProject;
    set({
      projects,
      currentProject: current?.id === id ? null : current,
    });
    if (current?.id === id) useEditorStore.getState().closeAll();
  },

  importProject: (project) => {
    const projects = [...get().projects, project];
    persist(projects, true);
    const first = findFirstFile(project.files);
    set({ projects, currentProject: project });
    if (first) useEditorStore.getState().openFile(first);
  },

  updateFileContent: (path, content) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    const newFiles = updateInTree(currentProject.files, path, content);
    const updated = { ...currentProject, files: newFiles };
    const newProjects = projects.map(p => p.id === updated.id ? updated : p);
    persist(newProjects); // debounced — hot path
    markDirty();           // trigger idle-timeout autosave
    set({ currentProject: updated, projects: newProjects });
    useEditorStore.getState().updateOpenFileContent(path, content);
  },

  addFile: (parentPath, file) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    const newFiles = addToTree(currentProject.files, parentPath, file);
    const updated = { ...currentProject, files: newFiles };
    const newProjects = projects.map(p => p.id === updated.id ? updated : p);
    persist(newProjects, true);
    set({ currentProject: updated, projects: newProjects });
  },

  deleteFile: (path) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    const newFiles = deleteFromTree(currentProject.files, path);
    const updated = { ...currentProject, files: newFiles };
    const newProjects = projects.map(p => p.id === updated.id ? updated : p);
    persist(newProjects, true);
    set({ currentProject: updated, projects: newProjects });
    useEditorStore.getState().closeFile(path);
  },

  renameFile: (path, newName) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    const newFiles = renameInTree(currentProject.files, path, newName, getLanguage);
    const updated = { ...currentProject, files: newFiles };
    const newProjects = projects.map(p => p.id === updated.id ? updated : p);
    persist(newProjects, true);
    set({ currentProject: updated, projects: newProjects });
    useEditorStore.getState().syncOpenFiles(newFiles);
  },
}));

// ─── Stable selectors ────────────────────────────────────────────────────────
export const selectProjects        = (s: ProjectState) => s.projects;
export const selectCurrentProject  = (s: ProjectState) => s.currentProject;
export const selectProjectActions  = (s: ProjectState) => ({
  createProject:     s.createProject,
  setCurrentProject: s.setCurrentProject,
  deleteProject:     s.deleteProject,
  importProject:     s.importProject,
  updateFileContent: s.updateFileContent,
  addFile:           s.addFile,
  deleteFile:        s.deleteFile,
  renameFile:        s.renameFile,
});
