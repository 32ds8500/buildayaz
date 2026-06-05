import React, { useState, useRef, useCallback } from 'react';
import { importFromZip, importFromFiles } from '../services/importService';
import toast from 'react-hot-toast';
import {
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { logger } from '../core/llm/logging/logger';
const log = logger.forModule('LandingPage');
  Zap, Code2, Globe, Server, Layout, Rocket,
  ArrowRight, Sparkles, Terminal, Eye, FolderOpen,
  Clock, Trash2, ChevronRight, Plus, Star, Shield,
  Cpu, Layers, GitBranch, MessageSquare,
  Upload, Archive, FolderUp, X, Loader2
} from 'lucide-react';

const templates = [
  {
    id: 'react',
    name: 'React + Vite',
    desc: 'Modern React uygulaması, Vite ile hızlı geliştirme',
    icon: <Code2 className="w-8 h-8" />,
    color: 'from-cyan-500 to-blue-500',
    tags: ['React 18', 'TypeScript', 'Vite'],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    desc: 'Full-stack React framework, SSR ve App Router',
    icon: <Globe className="w-8 h-8" />,
    color: 'from-gray-500 to-gray-700',
    tags: ['Next.js 14', 'App Router', 'Tailwind'],
  },
  {
    id: 'html',
    name: 'HTML/CSS/JS',
    desc: 'Sade web sayfası, framework gerektirmez',
    icon: <Layout className="w-8 h-8" />,
    color: 'from-orange-500 to-red-500',
    tags: ['HTML5', 'CSS3', 'JavaScript'],
  },
  {
    id: 'node',
    name: 'Node.js API',
    desc: 'Express.js ile REST API sunucusu',
    icon: <Server className="w-8 h-8" />,
    color: 'from-green-500 to-emerald-500',
    tags: ['Express', 'TypeScript', 'REST'],
  },
];

const features = [
  { icon: <Sparkles className="w-6 h-6" />, title: 'AI Destekli Kodlama', desc: 'Yapay zeka ile anında kod üretimi ve düzenleme' },
  { icon: <Terminal className="w-6 h-6" />, title: 'Entegre Terminal', desc: 'Yerleşik terminal ile komutlarınızı çalıştırın' },
  { icon: <Eye className="w-6 h-6" />, title: 'Canlı Önizleme', desc: 'Değişiklikleri anında tarayıcıda görün' },
  { icon: <FolderOpen className="w-6 h-6" />, title: 'Dosya Yönetimi', desc: 'Gelişmiş dosya ağacı ve düzenleme araçları' },
  { icon: <GitBranch className="w-6 h-6" />, title: 'Versiyon Kontrolü', desc: 'Git entegrasyonu ile değişiklik takibi' },
  { icon: <MessageSquare className="w-6 h-6" />, title: 'AI Sohbet', desc: 'Doğal dilde kod yazdırın ve soru sorun' },
  { icon: <Layers className="w-6 h-6" />, title: 'Çoklu Şablon', desc: 'React, Next.js, Node.js ve daha fazlası' },
  { icon: <Shield className="w-6 h-6" />, title: 'Tamamen Ücretsiz', desc: 'Hiçbir ücret veya abonelik gerektirmez' },
];

export const LandingPage: React.FC = () => {
  const { createProject, projects, setCurrentProject, deleteProject, importProject } = useProjectStore();
  const [projeAdi, setProjeAdi] = useState('');
  const [projeAciklama, setProjeAciklama] = useState('');
  const [seciliSablon, setSeciliSablon] = useState('react');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const name = projeAdi.trim() || `${seciliSablon}-proje-${Date.now().toString(36)}`;
    createProject(name, projeAciklama, seciliSablon);
    setShowNewProject(false);
  };

  const handlePromptCreate = () => {
    if (!prompt.trim()) return;
    const name = prompt.slice(0, 30).trim();
    createProject(name, prompt, 'react');
  };

  // ZIP yükleme
  const handleZipUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Lütfen .zip dosyası seçin');
      return;
    }
    setImporting(true);
    try {
      const project = await importFromZip(file);
      importProject(project);
      setShowImportModal(false);
      toast.success(`"${project.name}" başarıyla içe aktarıldı!`);
    } catch (err) {
      console.error(err);
      toast.error('ZIP dosyası içe aktarılırken hata oluştu');
    } finally {
      setImporting(false);
    }
  }, [importProject]);

  // Dosya yükleme
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    
    // Tek ZIP dosyası mı?
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      handleZipUpload(files[0]);
      return;
    }

    setImporting(true);
    try {
      const project = await importFromFiles(files);
      importProject(project);
      setShowImportModal(false);
      toast.success(`"${project.name}" başarıyla içe aktarıldı!`);
    } catch (err) {
      console.error(err);
      toast.error('Dosyalar içe aktarılırken hata oluştu');
    } finally {
      setImporting(false);
    }
  }, [importProject, handleZipUpload]);

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setShowImportModal(true);
      await handleFileUpload(files);
    }
  }, [handleFileUpload]);

  return (
    <div
      className="h-full bg-dark-900 overflow-y-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-dark-900/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-accent-blue bg-accent-blue/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-12 h-12 text-accent-blue" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Dosyaları Bırakın</h3>
            <p className="text-dark-200">ZIP veya proje dosyalarını sürükleyip bırakın</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/80 border-b border-dark-600/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg gradient-bg flex items-center justify-center">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-white">KodYap<span className="text-accent-blue">.ai</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 bg-dark-600 hover:bg-dark-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all border border-dark-500"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">İçe Aktar</span>
            </button>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1.5 bg-accent-blue hover:bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Yeni Proje</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-10 sm:py-16 md:py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-accent-blue/10 rounded-full blur-[80px] sm:blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-accent-purple/10 rounded-full blur-[80px] sm:blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs sm:text-sm mb-4 sm:mb-6">
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Tamamen Ücretsiz & Açık Kaynak</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-4 sm:mb-6 leading-tight">
            Fikrinizi{' '}
            <span className="gradient-text">Koda</span>{' '}
            Dönüştürün
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-dark-200 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
            Yapay zeka destekli kod editörü ile projelerinizi saniyeler içinde oluşturun.
          </p>

          {/* Prompt Input */}
          <div className="max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-blue via-accent-purple to-accent-pink rounded-xl blur opacity-30 group-hover:opacity-50 transition" />
              <div className="relative flex items-center bg-dark-700 rounded-xl border border-dark-500">
                <Sparkles className="w-5 h-5 text-accent-blue ml-3 sm:ml-4 flex-shrink-0" />
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePromptCreate()}
                  placeholder="Ne oluşturmak istiyorsunuz?"
                  className="flex-1 bg-transparent px-3 sm:px-4 py-3 sm:py-4 text-white placeholder-dark-300 outline-none text-sm sm:text-base min-w-0"
                />
                <button
                  onClick={handlePromptCreate}
                  className="m-1.5 sm:m-2 px-3 sm:px-5 py-2 sm:py-2.5 gradient-bg text-white rounded-lg font-medium hover:opacity-90 transition flex items-center gap-1.5 flex-shrink-0 text-sm"
                >
                  <Rocket className="w-4 h-4" />
                  <span className="hidden sm:inline">Oluştur</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 justify-center">
              {['Blog sitesi oluştur', 'Todo uygulaması yap', 'Dashboard tasarla'].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-dark-600/50 text-dark-200 hover:bg-dark-500 hover:text-white transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Import CTA */}
          <div className="flex items-center justify-center gap-3 text-sm text-dark-300 mb-2">
            <span>veya</span>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 text-accent-blue hover:text-blue-400 font-medium transition"
            >
              <Upload className="w-4 h-4" />
              Mevcut projeyi yükle
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Güçlü Özellikler</h2>
            <p className="text-dark-200 text-sm sm:text-lg">Modern web geliştirme için ihtiyacınız olan her şey</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="group p-4 sm:p-6 rounded-xl bg-dark-700/50 border border-dark-500/50 hover:border-accent-blue/30 transition-all duration-300 hover:bg-dark-700"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue mb-3 sm:mb-4 group-hover:bg-accent-blue/20 transition">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-base">{f.title}</h3>
                <p className="text-dark-200 text-xs sm:text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Şablonlar ile Başlayın</h2>
            <p className="text-dark-200 text-sm sm:text-lg">Hazır şablonları seçin ve hemen kodlamaya başlayın</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSeciliSablon(t.id);
                  setShowNewProject(true);
                }}
                className="group text-left p-4 sm:p-6 rounded-xl bg-dark-700/50 border border-dark-500/50 hover:border-accent-blue/50 transition-all duration-300"
              >
                <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white mb-3 sm:mb-4`}>
                  <span className="scale-75 sm:scale-100">{t.icon}</span>
                </div>
                <h3 className="text-white font-semibold text-sm sm:text-lg mb-1 sm:mb-2">{t.name}</h3>
                <p className="text-dark-200 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{t.desc}</p>
                <div className="hidden sm:flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-dark-500/50 text-dark-100">{tag}</span>
                  ))}
                </div>
                <div className="mt-2 sm:mt-4 flex items-center gap-1 text-accent-blue text-xs sm:text-sm font-medium opacity-0 group-hover:opacity-100 transition">
                  Başlat <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <section className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Son Projeler</h2>
              <span className="text-dark-200 text-xs sm:text-sm">{projects.length} proje</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {projects.slice().reverse().map((p) => (
                <div
                  key={p.id}
                  className="group p-4 sm:p-5 rounded-xl bg-dark-700/50 border border-dark-500/50 hover:border-accent-blue/30 transition-all cursor-pointer"
                  onClick={() => setCurrentProject(p)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${templates.find(t => t.id === p.template)?.color || 'from-blue-500 to-purple-500'} flex items-center justify-center text-white flex-shrink-0`}>
                        <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base truncate">{p.name}</h3>
                        <span className="text-dark-300 text-[10px] sm:text-xs uppercase">{p.template}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      className="p-1.5 rounded-lg text-dark-300 hover:text-red-400 hover:bg-dark-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {p.description && (
                    <p className="text-dark-200 text-xs sm:text-sm mb-3 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-dark-300">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                    <span className="flex items-center gap-1 text-accent-blue opacity-0 group-hover:opacity-100 transition">
                      Aç <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 border-t border-dark-600/50">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent-blue" />
            <span className="text-white font-bold text-sm sm:text-base">KodYap.ai</span>
          </div>
          <p className="text-dark-300 text-xs sm:text-sm">Yapay zeka destekli web geliştirme platformu • Tamamen Ücretsiz</p>
        </div>
      </footer>

      {/* Hidden file inputs */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="file-input-hidden"
        onChange={(e) => e.target.files?.[0] && handleZipUpload(e.target.files[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="file-input-hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // eslint-disable-next-line react/no-unknown-property
        {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        className="file-input-hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg bg-dark-800 rounded-t-2xl sm:rounded-2xl border-t sm:border border-dark-500 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-fade-in">
            <div className="p-4 sm:p-6 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-white">Yeni Proje Oluştur</h3>
                <button onClick={() => setShowNewProject(false)} className="p-1 text-dark-300 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">Proje Adı</label>
                <input
                  type="text"
                  value={projeAdi}
                  onChange={(e) => setProjeAdi(e.target.value)}
                  placeholder="Örn: Blog Uygulamam"
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-dark-300 focus:border-accent-blue focus:outline-none transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">Açıklama (opsiyonel)</label>
                <textarea
                  value={projeAciklama}
                  onChange={(e) => setProjeAciklama(e.target.value)}
                  placeholder="Projenizi kısaca tanımlayın..."
                  rows={2}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-dark-300 focus:border-accent-blue focus:outline-none transition resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-3">Şablon Seçin</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSeciliSablon(t.id)}
                      className={`text-left p-3 sm:p-4 rounded-lg border transition-all ${
                        seciliSablon === t.id
                          ? 'border-accent-blue bg-accent-blue/10'
                          : 'border-dark-500 bg-dark-700/50 hover:border-dark-400'
                      }`}
                    >
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center text-white mb-2`}>
                        <span className="scale-75 sm:scale-100">{t.icon}</span>
                      </div>
                      <div className="text-white font-medium text-xs sm:text-sm">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-dark-600 flex justify-end gap-3 sticky bottom-0 bg-dark-800">
              <button
                onClick={() => setShowNewProject(false)}
                className="px-4 py-2.5 rounded-lg text-dark-200 hover:text-white hover:bg-dark-600 transition text-sm"
              >
                İptal
              </button>
              <button
                onClick={handleCreate}
                className="px-5 sm:px-6 py-2.5 gradient-bg text-white rounded-lg font-medium hover:opacity-90 transition flex items-center gap-2 text-sm"
              >
                <Rocket className="w-4 h-4" />
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg bg-dark-800 rounded-t-2xl sm:rounded-2xl border-t sm:border border-dark-500 shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in">
            <div className="p-4 sm:p-6 border-b border-dark-600">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-white">Proje İçe Aktar</h3>
                <button onClick={() => setShowImportModal(false)} className="p-1 text-dark-300 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-dark-200 text-sm mt-2">Mevcut bir projeyi ZIP dosyası veya dosya/klasör olarak yükleyin</p>
            </div>

            {importing ? (
              <div className="p-10 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent-blue animate-spin mb-4" />
                <p className="text-white font-medium">Proje içe aktarılıyor...</p>
                <p className="text-dark-300 text-sm mt-1">Dosyalar okunuyor ve düzenleniyor</p>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-3">
                {/* ZIP Upload */}
                <button
                  onClick={() => zipInputRef.current?.click()}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-xl border-2 border-dashed border-dark-500 hover:border-accent-blue bg-dark-700/30 hover:bg-accent-blue/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-accent-blue/10 group-hover:bg-accent-blue/20 flex items-center justify-center flex-shrink-0 transition">
                    <Archive className="w-6 h-6 sm:w-7 sm:h-7 text-accent-blue" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm sm:text-base">ZIP Dosyası Yükle</h4>
                    <p className="text-dark-300 text-xs sm:text-sm mt-0.5">Sıkıştırılmış proje dosyanızı (.zip) seçin</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dark-400 group-hover:text-accent-blue transition ml-auto flex-shrink-0" />
                </button>

                {/* Folder Upload */}
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-xl border-2 border-dashed border-dark-500 hover:border-accent-purple bg-dark-700/30 hover:bg-accent-purple/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-accent-purple/10 group-hover:bg-accent-purple/20 flex items-center justify-center flex-shrink-0 transition">
                    <FolderUp className="w-6 h-6 sm:w-7 sm:h-7 text-accent-purple" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm sm:text-base">Klasör Yükle</h4>
                    <p className="text-dark-300 text-xs sm:text-sm mt-0.5">Proje klasörünüzü doğrudan seçin</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dark-400 group-hover:text-accent-purple transition ml-auto flex-shrink-0" />
                </button>

                {/* File Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-xl border-2 border-dashed border-dark-500 hover:border-accent-green bg-dark-700/30 hover:bg-accent-green/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-accent-green/10 group-hover:bg-accent-green/20 flex items-center justify-center flex-shrink-0 transition">
                    <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-accent-green" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm sm:text-base">Dosyalar Yükle</h4>
                    <p className="text-dark-300 text-xs sm:text-sm mt-0.5">Birden fazla dosya seçerek yükleyin</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dark-400 group-hover:text-accent-green transition ml-auto flex-shrink-0" />
                </button>

                {/* Drag & Drop hint */}
                <div className="text-center pt-2 pb-1">
                  <p className="text-dark-400 text-xs">veya dosyaları sayfaya sürükleyip bırakın</p>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-6 border-t border-dark-600 bg-dark-700/30">
              <div className="text-xs text-dark-300 space-y-1">
                <p>📌 <strong className="text-dark-100">node_modules</strong>, <strong className="text-dark-100">.git</strong>, <strong className="text-dark-100">dist</strong> klasörleri otomatik atlanır</p>
                <p>📌 Resim, video ve binary dosyalar atlanır</p>
                <p>📌 500KB üzeri dosyalar atlanır</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
