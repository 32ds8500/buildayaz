import React from 'react';
import { useStore } from '../store/useStore';
import { X, FileCode2, FileJson, FileText, File } from 'lucide-react';

const getTabIcon = (name: string): React.ReactNode => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['tsx', 'ts', 'jsx', 'js'].includes(ext)) return <FileCode2 className="w-3.5 h-3.5 text-blue-400" />;
  if (['json'].includes(ext)) return <FileJson className="w-3.5 h-3.5 text-yellow-400" />;
  if (['md', 'txt'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-gray-400" />;
  if (['html'].includes(ext)) return <FileCode2 className="w-3.5 h-3.5 text-orange-400" />;
  if (['css', 'scss'].includes(ext)) return <FileCode2 className="w-3.5 h-3.5 text-purple-400" />;
  return <File className="w-3.5 h-3.5 text-dark-200" />;
};

export const EditorTabs: React.FC = () => {
  const { openFiles, activeFile, setActiveFile, closeFile } = useStore();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-dark-800 border-b border-dark-600 overflow-x-auto no-scrollbar flex-shrink-0">
      {openFiles.map((file) => {
        const isActive = activeFile?.path === file.path;
        return (
          <div
            key={file.path}
            className={`editor-tab flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer border-r border-dark-600 min-w-0 flex-shrink-0 ${
              isActive ? 'active' : ''
            }`}
            onClick={() => setActiveFile(file)}
          >
            {getTabIcon(file.name)}
            <span className={`text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px] ${isActive ? 'text-white' : 'text-dark-200'}`}>
              {file.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
              className="p-0.5 rounded hover:bg-dark-500 flex-shrink-0 opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3 text-dark-200" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
