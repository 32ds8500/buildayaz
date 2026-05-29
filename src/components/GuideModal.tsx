import React, { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Zap,
  FolderTree, Code2, MessageSquare, Terminal, Eye,
  ShieldCheck, Upload, Download, Keyboard,
  Play, Monitor,
  Bot, ArrowRight
} from 'lucide-react';

interface Step {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const steps: Step[] = [
  {
    title: 'Hoş Geldiniz!',
    icon: <Zap className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">
          <strong className="text-white">KodYap.ai</strong> — Bolt.new benzeri, yapay zeka destekli, tarayıcı içi kod editörü platformu. Projelerinizi oluşturun, kodlayın, önizleyin ve dışa aktarın.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '🤖', text: 'AI ile kod üretimi' },
            { icon: '✏️', text: 'Monaco editör (VS Code)' },
            { icon: '👁️', text: 'Canlı önizleme' },
            { icon: '🖥️', text: 'Entegre terminal' },
            { icon: '🛡️', text: 'Otomatik hata ayıklama' },
            { icon: '📦', text: 'ZIP içe/dışa aktar' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-dark-700/50 rounded-lg px-3 py-2">
              <span className="text-lg">{f.icon}</span>
              <span className="text-xs text-dark-100">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Proje Oluşturma',
    icon: <Play className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">Proje oluşturmanın <strong className="text-white">3 yolu</strong> var:</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 bg-dark-700/50 rounded-xl p-3">
            <span className="w-7 h-7 rounded-lg bg-accent-blue/20 flex items-center justify-center flex-shrink-0 text-accent-blue font-bold text-xs">1</span>
            <div>
              <p className="text-white text-sm font-medium">Prompt ile Oluştur</p>
              <p className="text-dark-300 text-xs mt-0.5">Ana sayfadaki arama kutusuna ne istediğinizi yazın.<br/>Örn: <em>"Blog sitesi oluştur"</em></p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-dark-700/50 rounded-xl p-3">
            <span className="w-7 h-7 rounded-lg bg-accent-purple/20 flex items-center justify-center flex-shrink-0 text-accent-purple font-bold text-xs">2</span>
            <div>
              <p className="text-white text-sm font-medium">Şablon Seç</p>
              <p className="text-dark-300 text-xs mt-0.5">React, Next.js, HTML veya Node.js şablonlarından birini seçin ve <strong>"Yeni Proje"</strong> butonuna tıklayın.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-dark-700/50 rounded-xl p-3">
            <span className="w-7 h-7 rounded-lg bg-accent-green/20 flex items-center justify-center flex-shrink-0 text-accent-green font-bold text-xs">3</span>
            <div>
              <p className="text-white text-sm font-medium">İçe Aktar</p>
              <p className="text-dark-300 text-xs mt-0.5"><strong>"İçe Aktar"</strong> butonuna tıklayın → ZIP dosyası, klasör veya tekil dosyalar yükleyin. Sürükle-bırak da çalışır.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Çalışma Alanı',
    icon: <Monitor className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">Çalışma alanı <strong className="text-white">5 ana panel</strong>den oluşur. Her panel açılıp kapatılabilir:</p>
        <div className="space-y-1.5">
          {[
            { icon: <FolderTree className="w-4 h-4 text-yellow-400" />, name: 'Sol Panel — Dosya Gezgini', desc: 'Dosyalarınızı görüntüleyin, yeni dosya/klasör oluşturun, sağ tıklayarak yeniden adlandırın veya silin.' },
            { icon: <Code2 className="w-4 h-4 text-blue-400" />, name: 'Ortada — Kod Editörü', desc: 'Monaco (VS Code motoru) ile söz dizimi renklendirme, otomatik tamamlama, bracket pairing.' },
            { icon: <Eye className="w-4 h-4 text-cyan-400" />, name: 'Sağ Üst — Canlı Önizleme', desc: 'Kodunuzu kaydettiğinizde otomatik yenilenir. Masaüstü/Tablet/Mobil görünümü seçebilirsiniz.' },
            { icon: <MessageSquare className="w-4 h-4 text-purple-400" />, name: 'Sağ Alt — AI Sohbet', desc: 'Yapay zeka ile doğal dilde konuşarak kod üretin, bileşen oluşturun, hata çözün.' },
            { icon: <Terminal className="w-4 h-4 text-green-400" />, name: 'Alt — Terminal', desc: 'Komutları çalıştırın: npm install, npm run dev, git status, help yazın.' },
          ].map((p, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-dark-700/30 rounded-lg px-3 py-2">
              <span className="mt-0.5 flex-shrink-0">{p.icon}</span>
              <div>
                <p className="text-white text-xs font-medium">{p.name}</p>
                <p className="text-dark-300 text-[11px] mt-0.5 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-2 text-xs text-dark-200">
          <strong className="text-white">📱 Mobil:</strong> Alt sekme çubuğundan paneller arasında geçiş yapın. Sol üstteki ☰ butonu ile dosya gezginini açın.
        </div>
      </div>
    ),
  },
  {
    title: 'AI Asistan Kullanımı',
    icon: <Bot className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">AI sohbet panelinde <strong className="text-white">doğal Türkçe</strong> ile komut verebilirsiniz:</p>
        <div className="space-y-1.5">
          <p className="text-xs text-dark-300 font-semibold uppercase tracking-wider">Örnek komutlar:</p>
          {[
            { cmd: '"login formu yap"', desc: '→ Glassmorphism login formu üretir' },
            { cmd: '"dashboard oluştur"', desc: '→ İstatistik kartları + tablo' },
            { cmd: '"navbar yap"', desc: '→ Responsive navbar bileşeni' },
            { cmd: '"todo uygulaması"', desc: '→ Filtreleme + silme + ekleme' },
            { cmd: '"e-ticaret sayfası"', desc: '→ Ürün grid + sepet' },
            { cmd: '"buton bileşeni"', desc: '→ 5 varyant, loading, ikon' },
            { cmd: '"bu dosyayı açıkla"', desc: '→ Açık dosyayı analiz eder' },
            { cmd: '"hata ayıkla"', desc: '→ Debug rehberi verir' },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <code className="bg-dark-600 px-2 py-1 rounded text-accent-blue font-mono whitespace-nowrap">{e.cmd}</code>
              <span className="text-dark-300">{e.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-2 text-xs text-accent-blue">
          <strong>💡 İpucu:</strong> AI'ın ürettiği kod bloğundaki <strong>"Uygula"</strong> butonuna tıklayarak kodu doğrudan açık dosyaya yazabilirsiniz.
        </div>
      </div>
    ),
  },
  {
    title: 'Otomatik Hata Ayıklama',
    icon: <ShieldCheck className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">
          Error Agent <strong className="text-white">otomatik olarak</strong> kodunuzu tarar ve sorunları bulur:
        </p>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Nasıl kullanılır:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-dark-700/50 rounded-lg px-3 py-2">
              <span className="text-red-400 mt-0.5">1.</span>
              <p className="text-xs text-dark-100">Sol panelde <strong className="text-white">🛡️ kalkan ikonuna</strong> tıklayın → Kod Analizi paneli açılır</p>
            </div>
            <div className="flex items-start gap-2 bg-dark-700/50 rounded-lg px-3 py-2">
              <span className="text-yellow-400 mt-0.5">2.</span>
              <p className="text-xs text-dark-100">Otomatik mod açıksa, <strong className="text-white">her düzenlemenizde</strong> 1.5 saniye sonra tekrar tarar</p>
            </div>
            <div className="flex items-start gap-2 bg-dark-700/50 rounded-lg px-3 py-2">
              <span className="text-green-400 mt-0.5">3.</span>
              <p className="text-xs text-dark-100">Her hatanın yanındaki <strong className="text-white">"Düzelt"</strong> butonuna tıklayarak tek tek düzeltebilirsiniz</p>
            </div>
            <div className="flex items-start gap-2 bg-dark-700/50 rounded-lg px-3 py-2">
              <span className="text-blue-400 mt-0.5">4.</span>
              <p className="text-xs text-dark-100"><strong className="text-white">"Tümünü Düzelt"</strong> butonu ile tüm düzeltilebilir sorunları tek tıkla çözün</p>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-dark-300">Tespit edilen sorun türleri:</p>
          <div className="flex flex-wrap gap-1">
            {['console.log', 'var kullanımı', '== yerine ===', 'any tipi', 'boş catch', 'TODO/FIXME', 'key prop eksik', '!important', 'JSON hatası', 'alt eksik'].map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 bg-dark-600 rounded-full text-dark-200">{t}</span>
            ))}
          </div>
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-2 text-xs text-dark-200">
          <strong className="text-white">📊 Skor:</strong> 0-100 arası kod kalite puanı verilir. Editördeki alt durum çubuğunda da hata/uyarı sayısı görünür.
        </div>
      </div>
    ),
  },
  {
    title: 'Klavye Kısayolları',
    icon: <Keyboard className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">Hızlı erişim için kısayollar:</p>
        <div className="space-y-1">
          {[
            { key: '⌘K / Ctrl+K', desc: 'Komut Paleti — dosya ara, komut çalıştır' },
            { key: '⌘S / Ctrl+S', desc: 'Kaydet (otomatik kaydedilir)' },
            { key: 'Terminal: ↑ / ↓', desc: 'Komut geçmişinde gezin' },
            { key: 'Terminal: Tab', desc: 'Komut otomatik tamamlama' },
            { key: 'Terminal: help', desc: 'Kullanılabilir komutları listele' },
            { key: 'Terminal: clear', desc: 'Terminali temizle' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-dark-700/30 rounded-lg px-3 py-2">
              <kbd className="bg-dark-600 border border-dark-500 px-2 py-1 rounded text-[11px] text-accent-blue font-mono min-w-[120px] text-center">{s.key}</kbd>
              <span className="text-xs text-dark-200">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-2 text-xs text-dark-200">
          <strong className="text-white">💡</strong> Üst çubuktaki arama kutusuna tıklayarak da komut paletini açabilirsiniz.
        </div>
      </div>
    ),
  },
  {
    title: 'Dışa / İçe Aktarma',
    icon: <Download className="w-8 h-8" />,
    content: (
      <div className="space-y-4">
        <p className="text-dark-100 leading-relaxed">Projelerinizi bilgisayarınıza aktarabilir veya mevcut projeleri yükleyebilirsiniz:</p>
        <div className="space-y-2">
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-accent-green" />
              <p className="text-white text-sm font-medium">Dışa Aktar (ZIP)</p>
            </div>
            <p className="text-dark-300 text-xs">Çalışma alanındaki <strong>⬇ indirme</strong> ikonuna tıklayın. Projeniz .zip olarak bilgisayarınıza iner.</p>
          </div>
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-accent-blue" />
              <p className="text-white text-sm font-medium">İçe Aktar</p>
            </div>
            <p className="text-dark-300 text-xs">Ana sayfada <strong>"İçe Aktar"</strong> butonuna tıklayın. ZIP dosyası, klasör veya tekil dosyalar yükleyebilirsiniz. Sayfaya sürükle-bırak da çalışır.</p>
          </div>
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-2 text-xs text-dark-200">
          <strong className="text-white">📌</strong> node_modules, .git, dist klasörleri ve binary dosyalar otomatik atlanır.
        </div>
      </div>
    ),
  },
];

export const GuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white">
              {current.icon}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{current.title}</h2>
              <span className="text-[11px] text-dark-300">{step + 1} / {steps.length}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-600 text-dark-300 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-5 py-2 flex-shrink-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-accent-blue' : 'bg-dark-600'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {current.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-dark-600 flex-shrink-0">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-dark-200 hover:text-white hover:bg-dark-600 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>
          
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-5 py-2 gradient-bg text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              İleri
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2 bg-accent-green text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
            >
              Başla!
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
