import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { LandingPage } from './components/LandingPage';
import { Workspace } from './components/Workspace';
import { CommandPalette } from './components/CommandPalette';
import { GuideModal } from './components/GuideModal';
import { Toaster } from 'react-hot-toast';
import { CircleHelp } from 'lucide-react';
import { loadProjectsAsync } from './store/persistence';
import { initAutosave } from './store/autosave';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useProjectStore } from '../store/projectStore';

const App: React.FC = () => {
  const { view } = useUIStore();
  const [showGuide, setShowGuide] = useState(false);

  // ── Async IDB hydration: upgrade from localStorage on first load ──
  useEffect(() => {
    loadProjectsAsync().then(idbProjects => {
      if (idbProjects.length === 0) return;
      const current = useProjectStore.getState().projects;
      // Simple length check — avoid JSON.stringify for comparison
      if (idbProjects.length !== current.length) {
        useProjectStore.setState({ projects: idbProjects });
      }
    }).catch((err) => { console.warn('[App] IDB hydration failed, using localStorage:', err instanceof Error ? err.message : String(err)); });
  }, []);

  // ── Autosave: periodic + visibilitychange + beforeunload ──
  useEffect(() => {
    return initAutosave();
  }, []);

  // ── Guide modal ──
  useEffect(() => {
    const seen = localStorage.getItem('kodyap_guide_seen');
    if (!seen) {
      setShowGuide(true);
      localStorage.setItem('kodyap_guide_seen', '1');
    }
  }, []);


  return (
    <div className="h-full w-full overflow-hidden">
      {view === 'landing' ? <LandingPage /> : <Workspace />}
      {view === 'workspace' && <CommandPalette />}

      {/* Floating help button */}
      <button
        onClick={() => setShowGuide(true)}
        className="fixed bottom-4 right-4 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full gradient-bg text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Kullanım Kılavuzu"
      >
        <CircleHelp className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a2e',
            color: '#e0e0f0',
            border: '1px solid #2a2a45',
            borderRadius: '12px',
            fontSize: '13px',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1a1a2e' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#1a1a2e' } },
        }}
      />
    </div>
  );
};

export default App;
