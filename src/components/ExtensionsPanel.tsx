import React, { useState } from 'react';
import { Puzzle, Download, Trash2, Settings, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
  rating: number;
  downloads: number;
}

const AVAILABLE_EXTENSIONS: Extension[] = [
  {
    id: 'prettier',
    name: 'Prettier Formatter',
    version: '3.0.0',
    description: 'Kod formatlama ve stil standardizasyonu',
    author: 'Prettier Team',
    installed: true,
    rating: 4.9,
    downloads: 150000,
  },
  {
    id: 'eslint',
    name: 'ESLint Linter',
    version: '8.0.0',
    description: 'JavaScript kod kalitesi kontrol',
    author: 'ESLint Community',
    installed: true,
    rating: 4.8,
    downloads: 200000,
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS IntelliSense',
    version: '0.11.0',
    description: 'Tailwind CSS otomatik tamamlama',
    author: 'Tailwind Labs',
    installed: true,
    rating: 4.9,
    downloads: 100000,
  },
  {
    id: 'typescript',
    name: 'TypeScript Support',
    version: '5.0.0',
    description: 'TypeScript dili desteği ve IntelliSense',
    author: 'Microsoft',
    installed: true,
    rating: 5.0,
    downloads: 500000,
  },
  {
    id: 'jest',
    name: 'Jest Runner',
    version: '1.5.0',
    description: 'Jest testleri IDE içinde çalıştırın',
    author: 'Jest Community',
    installed: false,
    rating: 4.7,
    downloads: 50000,
  },
  {
    id: 'docker',
    name: 'Docker Support',
    version: '2.0.0',
    description: 'Docker dosyaları ve imajları yönetin',
    author: 'Docker',
    installed: false,
    rating: 4.6,
    downloads: 80000,
  },
];

export const ExtensionsPanel: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>(AVAILABLE_EXTENSIONS);
  const [filter, setFilter] = useState<'all' | 'installed'>('all');

  const toggleExtension = (id: string) => {
    setExtensions(
      extensions.map((ext) => {
        if (ext.id === id) {
          const newInstalled = !ext.installed;
          toast[newInstalled ? 'success' : 'loading'](
            newInstalled ? `${ext.name} kuruldu` : `${ext.name} kaldırıldı`
          );
          return { ...ext, installed: newInstalled };
        }
        return ext;
      })
    );
  };

  const filtered = extensions.filter((ext) => (filter === 'installed' ? ext.installed : true));

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-dark-600">
        <div className="flex items-center gap-2 mb-3">
          <Puzzle className="w-4 h-4 text-accent-purple" />
          <span className="text-xs font-semibold text-white">Eklentiler</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded text-xs transition ${
              filter === 'all'
                ? 'bg-accent-purple/20 text-accent-purple'
                : 'text-dark-300 hover:bg-dark-700'
            }`}
          >
            Tümü ({extensions.length})
          </button>
          <button
            onClick={() => setFilter('installed')}
            className={`px-2 py-1 rounded text-xs transition ${
              filter === 'installed'
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-dark-300 hover:bg-dark-700'
            }`}
          >
            Kurulu ({extensions.filter((e) => e.installed).length})
          </button>
        </div>
      </div>

      {/* Extensions List */}
      <div className="flex-1 overflow-y-auto divide-y divide-dark-700">
        {filtered.map((ext) => (
          <div key={ext.id} className="p-3 hover:bg-dark-700/50 transition group">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0 group-hover:bg-dark-600">
                <Puzzle className="w-4 h-4 text-dark-300" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-semibold text-white truncate">{ext.name}</h4>
                  <span className="text-[10px] text-dark-400 font-mono">{ext.version}</span>
                </div>
                <p className="text-xs text-dark-300 mb-2 line-clamp-2">{ext.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-dark-400">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    {ext.rating}
                  </div>
                  <span>•</span>
                  <span>{(ext.downloads / 1000).toFixed(0)}K</span>
                  <span>•</span>
                  <span>{ext.author}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {ext.installed ? (
                  <>
                    <button className="p-1.5 rounded hover:bg-dark-600 text-dark-300 hover:text-white transition">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleExtension(ext.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => toggleExtension(ext.id)}
                    className="px-2.5 py-1 rounded text-xs bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 transition flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Kur
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Puzzle className="w-8 h-8 text-dark-400 mx-auto mb-2" />
            <p className="text-xs text-dark-400">Eklenti bulunamadı</p>
          </div>
        </div>
      )}
    </div>
  );
};
