import React, { useState } from 'react';
import type { FileNode } from '../store/useStore';
import { useStore } from '../store/useStore';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FileCode2, FileJson, FileText, Image, Settings,
  Plus, Trash2, SquarePen, Ellipsis
} from 'lucide-react';

const getFileIcon = (name: string): React.ReactNode => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, React.ReactNode> = {
    'tsx': <FileCode2 className="w-4 h-4 text-blue-400" />,
    'ts': <FileCode2 className="w-4 h-4 text-blue-500" />,
    'jsx': <FileCode2 className="w-4 h-4 text-yellow-400" />,
    'js': <FileCode2 className="w-4 h-4 text-yellow-500" />,
    'html': <FileCode2 className="w-4 h-4 text-orange-400" />,
    'css': <FileCode2 className="w-4 h-4 text-purple-400" />,
    'scss': <FileCode2 className="w-4 h-4 text-pink-400" />,
    'json': <FileJson className="w-4 h-4 text-yellow-300" />,
    'md': <FileText className="w-4 h-4 text-gray-400" />,
    'svg': <Image className="w-4 h-4 text-green-400" />,
    'png': <Image className="w-4 h-4 text-green-400" />,
    'jpg': <Image className="w-4 h-4 text-green-400" />,
    'env': <Settings className="w-4 h-4 text-gray-500" />,
    'gitignore': <Settings className="w-4 h-4 text-gray-500" />,
  };
  return iconMap[ext] || <File className="w-4 h-4 text-dark-200" />;
};

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, depth }) => {
  const { activeFile, openFile, deleteFile, renameFile, addFile } = useStore();
  const [expanded, setExpanded] = useState(depth < 2);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [adding, setAdding] = useState<'file' | 'folder' | null>(null);
  const [addName, setAddName] = useState('');

  const isActive = activeFile?.path === node.path;

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(!expanded);
    } else {
      openFile(node);
    }
  };

  const handleRename = () => {
    if (newName.trim() && newName !== node.name) {
      renameFile(node.path, newName.trim());
    }
    setRenaming(false);
  };

  const handleAdd = () => {
    if (!addName.trim()) { setAdding(null); return; }
    const newFile: FileNode = {
      name: addName.trim(),
      path: `${node.path}/${addName.trim()}`,
      type: adding!,
      ...(adding === 'file' ? { content: '', language: 'plaintext' } : { children: [] }),
    };
    addFile(node.path, newFile);
    setAdding(null);
    setAddName('');
    setExpanded(true);
  };

  return (
    <div>
      <div
        className={`file-tree-item flex items-center gap-1 px-2 py-1 cursor-pointer text-sm group ${
          isActive ? 'active' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
      >
        {node.type === 'folder' ? (
          <>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="w-4 h-4 text-accent-blue flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-accent-blue flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}

        {renaming ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            className="flex-1 bg-dark-600 text-white text-xs px-1 py-0.5 rounded outline-none border border-accent-blue"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate text-xs ${isActive ? 'text-white font-medium' : 'text-dark-100'}`}>
            {node.name}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          {node.type === 'folder' && (
            <button
              onClick={(e) => { e.stopPropagation(); setAdding('file'); setExpanded(true); }}
              className="p-0.5 hover:bg-dark-500 rounded"
              title="Yeni Dosya"
            >
              <Plus className="w-3.5 h-3.5 text-dark-200" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-0.5 hover:bg-dark-500 rounded"
          >
            <Ellipsis className="w-3.5 h-3.5 text-dark-200" />
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div className="ml-8 mr-2 mb-1 bg-dark-600 rounded-lg border border-dark-500 shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={() => { setRenaming(true); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-dark-100 hover:bg-dark-500 hover:text-white"
          >
            <SquarePen className="w-3 h-3" /> Yeniden Adlandır
          </button>
          {node.type === 'folder' && (
            <>
              <button
                onClick={() => { setAdding('file'); setShowMenu(false); setExpanded(true); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-dark-100 hover:bg-dark-500 hover:text-white"
              >
                <Plus className="w-3 h-3" /> Yeni Dosya
              </button>
              <button
                onClick={() => { setAdding('folder'); setShowMenu(false); setExpanded(true); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-dark-100 hover:bg-dark-500 hover:text-white"
              >
                <Folder className="w-3 h-3" /> Yeni Klasör
              </button>
            </>
          )}
          <button
            onClick={() => { deleteFile(node.path); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-dark-500"
          >
            <Trash2 className="w-3 h-3" /> Sil
          </button>
        </div>
      )}

      {/* Add new file/folder input */}
      {adding && (
        <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
          {adding === 'folder' ? <Folder className="w-4 h-4 text-accent-blue" /> : <File className="w-4 h-4 text-dark-200" />}
          <input
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(null); }}
            placeholder={adding === 'file' ? 'dosya_adi.tsx' : 'klasor_adi'}
            className="flex-1 bg-dark-600 text-white text-xs px-2 py-1 rounded outline-none border border-accent-blue"
          />
        </div>
      )}

      {/* Children */}
      {node.type === 'folder' && expanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              if (a.type === 'folder' && b.type !== 'folder') return -1;
              if (a.type !== 'folder' && b.type === 'folder') return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem key={child.path} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC = () => {
  const { currentProject } = useStore();

  if (!currentProject) return null;

  return (
    <div className="py-1">
      {currentProject.files
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        })
        .map((node) => (
          <FileTreeItem key={node.path} node={node} depth={0} />
        ))}
    </div>
  );
};
