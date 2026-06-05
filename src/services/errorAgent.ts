/**
 * KodYap Error Agent — Gerçek zamanlı otomatik hata tespiti & düzeltme motoru
 * 
 * Desteklenen diller: TypeScript/JavaScript, HTML, CSS, JSON
 * Kural türleri: Syntax, Logic, Best Practice, Security, Performance, A11y
 */

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  id: string;
  file: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  message: string;
  severity: Severity;
  code: string;        // kural kodu, ör: "TS001"
  source: string;      // "KodYap Agent"
  category: string;    // syntax | logic | best-practice | security | performance | a11y
  fix?: AutoFix;
}

export interface AutoFix {
  label: string;
  description: string;
  newText: string;         // satırın tamamını değiştirir
  lineStart: number;
  lineEnd: number;
}

export interface AgentReport {
  diagnostics: Diagnostic[];
  score: number;            // 0-100 kod kalite skoru
  summary: string;
  timestamp: number;
}

let diagId = 0;
function mkId() { return 'diag-' + (++diagId); }

// ─────────────────────── Kural Motorları ───────────────────────

type RuleFn = (lines: string[], filename: string) => Diagnostic[];

// ── JavaScript / TypeScript kuralları
const jsRules: RuleFn[] = [

  // console.log bırakılmış
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      const col = line.indexOf('console.log');
      if (col !== -1 && !line.trimStart().startsWith('//')) {
        diags.push({
          id: mkId(), file, line: i + 1, col: col + 1, endLine: i + 1, endCol: col + 12,
          message: 'console.log() üretimde bırakılmamalı',
          severity: 'warning', code: 'JS001', source: 'KodYap Agent', category: 'best-practice',
          fix: { label: 'console.log kaldır', description: 'Bu satırı yorum satırına çevirir', newText: line.replace(/console\.log\([^)]*\);?/, '// console.log removed'), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // var kullanımı
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      const match = line.match(/\bvar\s+(\w+)/);
      if (match) {
        const col = line.indexOf('var');
        diags.push({
          id: mkId(), file, line: i + 1, col: col + 1, endLine: i + 1, endCol: col + 4,
          message: `'var' yerine 'const' veya 'let' kullanın`,
          severity: 'warning', code: 'JS002', source: 'KodYap Agent', category: 'best-practice',
          fix: { label: 'const ile değiştir', description: 'var → const', newText: line.replace(/\bvar\b/, 'const'), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // == yerine === kullanımı
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      // == veya != bul ama === ve !== hariç
      const regex = /(?<!=)(==)(?!=)|(?<!!)(!= )(?!=)/g;
      let m;
      while ((m = regex.exec(line)) !== null) {
        diags.push({
          id: mkId(), file, line: i + 1, col: m.index + 1, endLine: i + 1, endCol: m.index + 3,
          message: `'${m[0].trim()}' yerine '${m[0].trim() === '==' ? '===' : '!=='}' kullanın (katı eşitlik)`,
          severity: 'warning', code: 'JS003', source: 'KodYap Agent', category: 'logic',
          fix: { label: 'Katı eşitlik kullan', description: `== → ===`, newText: line.substring(0, m.index) + (m[0].trim() === '==' ? '===' : '!==') + line.substring(m.index + m[0].length), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // any tipini tespit
  (lines, file) => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return [];
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      const match = line.match(/:\s*any\b/);
      if (match) {
        const col = line.indexOf(': any');
        diags.push({
          id: mkId(), file, line: i + 1, col: col + 1, endLine: i + 1, endCol: col + 6,
          message: "'any' tipi kullanmaktan kaçının, belirli bir tip tanımlayın",
          severity: 'info', code: 'TS001', source: 'KodYap Agent', category: 'best-practice',
          fix: { label: 'unknown ile değiştir', description: 'any → unknown', newText: line.replace(/:\s*any\b/, ': unknown'), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // Kullanılmayan değişken (basit tespit)
  (lines, file) => {
    const diags: Diagnostic[] = [];
    const declared: { name: string; line: number; col: number }[] = [];
    const fullText = lines.join('\n');

    lines.forEach((line, i) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      // const/let tanımları
      const match = line.match(/(?:const|let)\s+(\w+)\s*=/);
      if (match && match[1] && match[1] !== '_' && !match[1].startsWith('_')) {
        declared.push({ name: match[1], line: i + 1, col: line.indexOf(match[1]) + 1 });
      }
    });

    declared.forEach(d => {
      // Tanımlanan satır dışında kullanılıyor mu?
      const regex = new RegExp('\\b' + d.name + '\\b', 'g');
      const matches = fullText.match(regex);
      if (matches && matches.length <= 1) {
        diags.push({
          id: mkId(), file, line: d.line, col: d.col, endLine: d.line, endCol: d.col + d.name.length,
          message: `'${d.name}' tanımlanmış ama hiç kullanılmamış`,
          severity: 'warning', code: 'JS004', source: 'KodYap Agent', category: 'logic',
          fix: { label: 'Satırı kaldır', description: 'Kullanılmayan değişken satırını siler', newText: '// ' + lines[d.line - 1], lineStart: d.line, lineEnd: d.line },
        });
      }
    });
    return diags;
  },

  // Boş catch bloğu
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
        diags.push({
          id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
          message: 'Boş catch bloğu — hatalar sessizce yutulur',
          severity: 'warning', code: 'JS005', source: 'KodYap Agent', category: 'logic',
          fix: { label: 'console.error ekle', description: 'Hata loglama ekler', newText: line.replace(/catch\s*\((\w+)\)\s*\{\s*\}/, 'catch ($1) { console.error($1); }'), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // TODO/FIXME/HACK yorumları
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      const match = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[\s:](.*)/i);
      if (match) {
        diags.push({
          id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
          message: `${match[1].toUpperCase()}: ${match[2].trim()}`,
          severity: 'info', code: 'JS006', source: 'KodYap Agent', category: 'best-practice',
        });
      }
    });
    return diags;
  },

  // async fonksiyonda await eksik
  (lines, file) => {
    const diags: Diagnostic[] = [];
    const fullText = lines.join('\n');
    const asyncRegex = /async\s+(?:function\s+)?(\w+)/g;
    let m;
    while ((m = asyncRegex.exec(fullText)) !== null) {
      const fnName = m[1];
      // Bu fonksiyon gövdesinde await var mı basit kontrol
      const afterIdx = m.index + m[0].length;
      const snippet = fullText.slice(afterIdx, afterIdx + 500);
      const braceCount = (snippet.match(/\{/g) || []).length;
      if (braceCount > 0 && !snippet.includes('await')) {
        const lineNum = fullText.slice(0, m.index).split('\n').length;
        diags.push({
          id: mkId(), file, line: lineNum, col: 1, endLine: lineNum, endCol: 50,
          message: `'${fnName}' async olarak tanımlı ama await kullanmıyor`,
          severity: 'info', code: 'JS007', source: 'KodYap Agent', category: 'performance',
        });
      }
    }
    return diags;
  },

  // React: key prop eksik (map)
  (lines, file) => {
    if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return [];
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      if (line.includes('.map(') && i + 3 < lines.length) {
        const nextLines = lines.slice(i, i + 5).join(' ');
        if (nextLines.includes('<') && !nextLines.includes('key=') && !nextLines.includes('key ={')) {
          diags.push({
            id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
            message: 'map() içinde JSX elementine key prop eklenmemiş olabilir',
            severity: 'warning', code: 'RX001', source: 'KodYap Agent', category: 'logic',
          });
        }
      }
    });
    return diags;
  },

  // Hardcoded string (i18n)
  (lines, file) => {
    if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return [];
    const diags: Diagnostic[] = [];
    let count = 0;
    lines.forEach((line, i) => {
      if (count >= 2) return;
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import')) return;
      // JSX içinde Türkçe/hardcoded string
      const match = line.match(/>([A-ZÇĞİÖŞÜa-zçğıöşü]{15,})</);
      if (match) {
        count++;
        diags.push({
          id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
          message: `Uzun sabit metin tespit edildi — çoklu dil desteği için i18n kullanmayı düşünün`,
          severity: 'hint', code: 'RX002', source: 'KodYap Agent', category: 'best-practice',
        });
      }
    });
    return diags;
  },
];

// ── CSS kuralları
const cssRules: RuleFn[] = [
  // !important kullanımı
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      if (line.includes('!important')) {
        const col = line.indexOf('!important');
        diags.push({
          id: mkId(), file, line: i + 1, col: col + 1, endLine: i + 1, endCol: col + 11,
          message: '!important kullanımından kaçının — specificity sorunlarına yol açar',
          severity: 'warning', code: 'CSS001', source: 'KodYap Agent', category: 'best-practice',
          fix: { label: '!important kaldır', description: '!important ifadesini siler', newText: line.replace(/\s*!important/g, ''), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },

  // Satır içi renk hex, rgb vs
  (lines, file) => {
    const diags: Diagnostic[] = [];
    let count = 0;
    lines.forEach((line, i) => {
      if (count >= 3) return;
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
      if (/#[0-9a-fA-F]{6}\b/.test(line) && !line.includes('var(') && !line.includes('--')) {
        count++;
        diags.push({
          id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
          message: 'Sabit renk kodu yerine CSS değişkeni kullanmayı düşünün',
          severity: 'hint', code: 'CSS002', source: 'KodYap Agent', category: 'best-practice',
        });
      }
    });
    return diags;
  },
];

// ── JSON kuralları
const jsonRules: RuleFn[] = [
  (lines, file) => {
    const diags: Diagnostic[] = [];
    const fullText = lines.join('\n');
    try {
      JSON.parse(fullText);
    } catch (e) {
      const msg = String(e.message || e);
      const posMatch = msg.match(/position\s+(\d+)/i);
      let line = 1;
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        line = fullText.slice(0, pos).split('\n').length;
      }
      diags.push({
        id: mkId(), file, line, col: 1, endLine: line, endCol: (lines[line - 1] || '').length + 1,
        message: `JSON parse hatası: ${msg}`,
        severity: 'error', code: 'JSON001', source: 'KodYap Agent', category: 'syntax',
      });
    }
    return diags;
  },
];

// ── HTML kuralları
const htmlRules: RuleFn[] = [
  // alt attribute eksik
  (lines, file) => {
    const diags: Diagnostic[] = [];
    lines.forEach((line, i) => {
      if (/<img\b/.test(line) && !/alt\s*=/.test(line)) {
        diags.push({
          id: mkId(), file, line: i + 1, col: 1, endLine: i + 1, endCol: line.length,
          message: '<img> etiketinde alt attribute eksik (erişilebilirlik)',
          severity: 'warning', code: 'A11Y001', source: 'KodYap Agent', category: 'a11y',
          fix: { label: 'alt="" ekle', description: 'Boş alt ekler', newText: line.replace(/<img\b/, '<img alt=""'), lineStart: i + 1, lineEnd: i + 1 },
        });
      }
    });
    return diags;
  },
];

// ────────────────────── Ana Analiz Fonksiyonu ──────────────────────

export function analyzeFile(content: string, filename: string): Diagnostic[] {
  const lines = content.split('\n');
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  let rules: RuleFn[] = [];

  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) rules = jsRules;
  else if (['css', 'scss'].includes(ext)) rules = cssRules;
  else if (ext === 'json') rules = jsonRules;
  else if (['html', 'htm'].includes(ext)) rules = [...htmlRules, ...cssRules];
  else return [];

  const diagnostics: Diagnostic[] = [];
  for (const rule of rules) {
    try {
      diagnostics.push(...rule(lines, filename));
    } catch { /* kural hatası yut */ }
  }
  return diagnostics;
}

export function analyzeProject(files: { name: string; path: string; content: string }[]): AgentReport {
  const allDiags: Diagnostic[] = [];

  for (const f of files) {
    if (!f.content) continue;
    const diags = analyzeFile(f.content, f.name);
    allDiags.push(...diags);
  }

  const errors = allDiags.filter(d => d.severity === 'error').length;
  const warnings = allDiags.filter(d => d.severity === 'warning').length;
  const infos = allDiags.filter(d => d.severity === 'info').length;

  // Skor hesapla
  let score = 100;
  score -= errors * 15;
  score -= warnings * 5;
  score -= infos * 1;
  score = Math.max(0, Math.min(100, score));

  let summary: string;
  if (score >= 90) summary = '🟢 Harika! Kodunuz çok temiz.';
  else if (score >= 70) summary = '🟡 İyi durumda, birkaç iyileştirme yapılabilir.';
  else if (score >= 50) summary = '🟠 Düzeltilmesi gereken sorunlar var.';
  else summary = '🔴 Kritik sorunlar mevcut, acil düzeltme gerekiyor.';

  return { diagnostics: allDiags, score, summary, timestamp: Date.now() };
}

/**
 * Otomatik düzeltme uygula — verilen fix'i dosya içeriğine uygular
 */
export function applyFix(content: string, fix: AutoFix): string {
  const lines = content.split('\n');
  const result = [...lines];
  // lineStart → lineEnd arasını newText ile değiştir
  const replacement = fix.newText.split('\n');
  result.splice(fix.lineStart - 1, fix.lineEnd - fix.lineStart + 1, ...replacement);
  return result.join('\n');
}

/**
 * Tüm otomatik düzeltilebilir sorunları bir seferde uygula
 */
export function applyAllFixes(content: string, diagnostics: Diagnostic[]): string {
  // Satır numarasına göre sondan başa sırala (index kaymasını önlemek için)
  const fixable = diagnostics
    .filter(d => d.fix)
    .sort((a, b) => (b.fix!.lineStart - a.fix!.lineStart));

  let result = content;
  for (const d of fixable) {
    result = applyFix(result, d.fix!);
  }
  return result;
}
