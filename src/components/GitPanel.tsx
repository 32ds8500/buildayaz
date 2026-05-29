import React, { useState } from 'react';
import { GitBranch, GitCommit, Settings, AlertCircle } from 'lucide-react';

export const GitPanel: React.FC = () => {
  const [currentBranch, setCurrentBranch] = useState('main');
  const branches = ['main', 'develop'];
  const commits = [
    {
      hash: 'abc1234',
      message: 'Initial commit',
      author: 'You',
      date: new Date().toLocaleDateString(),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      {/* Current Branch */}
      <div className="flex-shrink-0 p-3 border-b border-dark-600">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-semibold text-white">Geçerli Dal</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-700 rounded-lg border border-dark-600">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-mono text-white flex-1">{currentBranch}</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-dark-600">
        <div className="text-xs text-dark-300 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Çalışan dizin temiz
        </div>
      </div>

      {/* Branches */}
      <div className="flex-shrink-0 p-3 border-b border-dark-600">
        <div className="text-xs font-semibold text-dark-200 mb-2">Dallar ({branches.length})</div>
        <div className="space-y-1">
          {branches.map((branch) => (
            <button
              key={branch}
              onClick={() => setCurrentBranch(branch)}
              className={`w-full px-2 py-1.5 rounded text-xs text-left transition ${
                branch === currentBranch
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                  : 'text-dark-300 hover:bg-dark-700 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${branch === currentBranch ? 'bg-accent-blue' : 'bg-dark-500'}`} />
                {branch}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Commits */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="text-xs font-semibold text-dark-200 mb-2">Geçmiş</div>
        <div className="space-y-2">
          {commits.map((commit) => (
            <div key={commit.hash} className="p-2 bg-dark-700/50 rounded border border-dark-600 hover:border-dark-500 transition">
              <div className="flex items-start gap-2">
                <GitCommit className="w-3 h-3 text-dark-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-dark-300">{commit.hash}</p>
                  <p className="text-xs text-white mt-0.5 line-clamp-2">{commit.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-dark-400">
                    <span>{commit.author}</span>
                    <span>•</span>
                    <span>{commit.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-dark-600 flex items-center justify-between">
        <span className="text-xs text-dark-400">Git entegrasyonu aktif</span>
        <button className="p-1 rounded hover:bg-dark-700 text-dark-300">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
