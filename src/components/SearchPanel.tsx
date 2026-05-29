import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Search, FileText, ChevronRight } from 'lucide-react';
import type { FileNode } from '../store/useStore';

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ file: FileNode; matches: number }>>([]);
  const { currentProject, setActiveFile } = useStore();

  const search = useCallback(() => {
    if (!query.trim() || !currentProject) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const found: Array<{ file: FileNode; matches: number }> = [];

    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          let matches = 0;
          if (node.name.toLowerCase().includes(q)) matches += 1;
          if (node.content?.toLowerCase().includes(q)) {
            const lines = (node.content || '').split('\n');
            matches += lines.filter(l => l.toLowerCase().includes(q)).length;
          }
          if (matches > 0) {
            found.push({ file: node, matches });
          }
        } else if (node.children) {
          walk(node.children);
        }
      }
    };

    walk(currentProject.files);
    setResults(found.sort((a, b) => b.matches - a.matches));
  }, [query, currentProject]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      {/* Search Input */}
      <div className="flex-shrink-0 p-3 border-b border-dark-600">
        <div className="flex items-center gap-2 bg-dark-700 rounded-lg px-2 py-1.5 border border-dark-600 focus-within:border-accent-blue">
          <Search className="w-4 h-4 text-dark-300" />
          <input
            type="text"
            placeholder="Dosya veya içerik ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-dark-300"
          />
        </div>
        {query && (
          <p className="text-xs text-dark-300 mt-2">
            {results.length} dosyada {results.reduce((s, r) => s + r.matches, 0)} sonuç bulundu
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="p-4 text-center text-dark-300 text-sm">
            {query ? 'Sonuç bulunamadı' : 'Arama yapmak için metin girin'}
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {results.map((result, i) => (
              <button
                key={i}
                onClick={() => setActiveFile(result.file)}
                className="w-full p-3 hover:bg-dark-700 text-left transition group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
                  <span className="text-xs font-mono text-dark-200 truncate flex-1 group-hover:text-accent-blue">
                    {result.file.path}
                  </span>
                  <ChevronRight className="w-3 h-3 text-dark-400 opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-xs text-dark-400 ml-5">
                  {result.matches} {result.matches === 1 ? 'eşleşme' : 'eşleşme'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
