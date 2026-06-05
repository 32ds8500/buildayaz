/**
 * Project utilities — language detection, templates, file tree helpers
 * Extracted from monolithic useStore for reuse across stores
 */
import type { FileNode } from './types';

export const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
    'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json',
    'md': 'markdown', 'py': 'python', 'rs': 'rust', 'go': 'go',
    'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml', 'xml': 'xml',
    'sql': 'sql', 'sh': 'shell', 'bash': 'shell', 'env': 'plaintext',
    'svg': 'xml', 'vue': 'html', 'svelte': 'html',
  };
  return langMap[ext] || 'plaintext';
};

// Templates
const reactTemplate: FileNode[] = [
  {
    name: 'src', path: '/src', type: 'folder', children: [
      {
        name: 'App.tsx', path: '/src/App.tsx', type: 'file', language: 'typescript',
        content: `import React, { useState } from 'react';\nimport './App.css';\n\nfunction App() {\n  const [sayac, setSayac] = useState(0);\n\n  return (\n    <div className="app">\n      <header className="app-header">\n        <h1>🚀 React Uygulamam</h1>\n        <p>Merhaba Dünya! Bu benim ilk React uygulamam.</p>\n        <div className="counter">\n          <button onClick={() => setSayac(sayac - 1)}>-</button>\n          <span>{sayac}</span>\n          <button onClick={() => setSayac(sayac + 1)}>+</button>\n        </div>\n      </header>\n    </div>\n  );\n}\n\nexport default App;`
      },
      {
        name: 'App.css', path: '/src/App.css', type: 'file', language: 'css',
        content: `.app {\n  text-align: center;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: linear-gradient(135deg, #0f172a, #1e293b);\n  color: white;\n}\n\n.app-header h1 {\n  font-size: 2.5rem;\n  margin-bottom: 1rem;\n}\n\n.counter {\n  display: flex;\n  align-items: center;\n  gap: 1rem;\n  margin-top: 2rem;\n  justify-content: center;\n}\n\n.counter button {\n  padding: 0.5rem 1.5rem;\n  font-size: 1.5rem;\n  border: none;\n  border-radius: 8px;\n  background: #3b82f6;\n  color: white;\n  cursor: pointer;\n}\n\n.counter span {\n  font-size: 2rem;\n  min-width: 60px;\n}`
      },
      {
        name: 'main.tsx', path: '/src/main.tsx', type: 'file', language: 'typescript',
        content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './App.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`
      },
    ]
  },
  {
    name: 'public', path: '/public', type: 'folder', children: [
      { name: 'index.html', path: '/public/index.html', type: 'file', language: 'html', content: `<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>React Uygulamam</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>` },
    ]
  },
  { name: 'package.json', path: '/package.json', type: 'file', language: 'json', content: `{\n  "name": "react-uygulamam",\n  "private": true,\n  "version": "1.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.0.0",\n    "vite": "^5.0.0"\n  }\n}` },
  { name: 'tsconfig.json', path: '/tsconfig.json', type: 'file', language: 'json', content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "jsx": "react-jsx",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "esModuleInterop": true\n  },\n  "include": ["src"]\n}` },
  { name: 'vite.config.ts', path: '/vite.config.ts', type: 'file', language: 'typescript', content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});` },
  { name: 'README.md', path: '/README.md', type: 'file', language: 'markdown', content: `# React Uygulamam\n\nBu proje Vite ile oluşturulmuştur.\n\n## Başlangıç\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Derleme\n\n\`\`\`bash\nnpm run build\n\`\`\`\n` },
];

const nextjsTemplate: FileNode[] = [
  {
    name: 'app', path: '/app', type: 'folder', children: [
      {
        name: 'page.tsx', path: '/app/page.tsx', type: 'file', language: 'typescript',
        content: `export default function AnaSayfa() {\n  return (\n    <main className="flex min-h-screen flex-col items-center justify-center p-24">\n      <h1 className="text-4xl font-bold mb-4">Next.js Uygulamam</h1>\n      <p className="text-lg text-gray-600">Merhaba Dünya!</p>\n    </main>\n  );\n}`
      },
      {
        name: 'layout.tsx', path: '/app/layout.tsx', type: 'file', language: 'typescript',
        content: `import type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  title: 'Next.js Uygulamam',\n  description: 'Next.js ile oluşturuldu',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="tr">\n      <body>{children}</body>\n    </html>\n  );\n}`
      },
      {
        name: 'globals.css', path: '/app/globals.css', type: 'file', language: 'css',
        content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  background: #0f172a;\n  color: #e2e8f0;\n}`
      },
    ]
  },
  { name: 'package.json', path: '/package.json', type: 'file', language: 'json', content: `{\n  "name": "nextjs-uygulamam",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "next": "^14.0.0",\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}` },
  { name: 'next.config.js', path: '/next.config.js', type: 'file', language: 'javascript', content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\n\nmodule.exports = nextConfig;` },
  { name: 'tailwind.config.js', path: '/tailwind.config.js', type: 'file', language: 'javascript', content: `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],\n  theme: { extend: {} },\n  plugins: [],\n};` },
];

const htmlTemplate: FileNode[] = [
  {
    name: 'index.html', path: '/index.html', type: 'file', language: 'html',
    content: `<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Web Sayfam</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <header>\n    <nav>\n      <h1>🌐 Web Sayfam</h1>\n      <ul>\n        <li><a href="#anasayfa">Ana Sayfa</a></li>\n        <li><a href="#hakkinda">Hakkında</a></li>\n        <li><a href="#iletisim">İletişim</a></li>\n      </ul>\n    </nav>\n  </header>\n  <main>\n    <section id="anasayfa" class="hero">\n      <h2>Merhaba Dünya!</h2>\n      <p>Bu benim ilk web sayfam.</p>\n      <button onclick="selamla()">Tıkla</button>\n    </section>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>`
  },
  {
    name: 'style.css', path: '/style.css', type: 'file', language: 'css',
    content: `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n  background: #0f172a;\n  color: #e2e8f0;\n}\n\nnav {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 1rem 2rem;\n  background: #1e293b;\n}\n\nnav ul {\n  display: flex;\n  list-style: none;\n  gap: 1.5rem;\n}\n\nnav a {\n  color: #94a3b8;\n  text-decoration: none;\n}\n\n.hero {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 80vh;\n  text-align: center;\n}\n\n.hero h2 {\n  font-size: 3rem;\n  margin-bottom: 1rem;\n}\n\n.hero button {\n  margin-top: 2rem;\n  padding: 0.75rem 2rem;\n  font-size: 1.1rem;\n  background: #3b82f6;\n  color: white;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n}`
  },
  {
    name: 'script.js', path: '/script.js', type: 'file', language: 'javascript',
    content: `function selamla() {\n  alert('Merhaba! Web sayfama hoş geldiniz.');\n}\n\nconsole.log('Sayfa yüklendi!');`
  },
];

const nodeTemplate: FileNode[] = [
  {
    name: 'src', path: '/src', type: 'folder', children: [
      {
        name: 'index.ts', path: '/src/index.ts', type: 'file', language: 'typescript',
        content: `import express from 'express';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\n// Ana sayfa\napp.get('/', (req, res) => {\n  res.json({ mesaj: 'Merhaba Dünya!', durum: 'aktif' });\n});\n\n// Kullanıcılar\napp.get('/api/kullanicilar', (req, res) => {\n  res.json([\n    { id: 1, isim: 'Ahmet', email: 'ahmet@ornek.com' },\n    { id: 2, isim: 'Ayşe', email: 'ayse@ornek.com' },\n  ]);\n});\n\napp.listen(PORT, () => {\n  console.log(\`Sunucu \${PORT} portunda çalışıyor\`);\n});`
      },
    ]
  },
  { name: 'package.json', path: '/package.json', type: 'file', language: 'json', content: `{\n  "name": "node-api",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "tsx watch src/index.ts",\n    "build": "tsc",\n    "start": "node dist/index.js"\n  },\n  "dependencies": {\n    "express": "^4.18.0"\n  },\n  "devDependencies": {\n    "@types/express": "^4.17.0",\n    "tsx": "^4.0.0",\n    "typescript": "^5.0.0"\n  }\n}` },
  { name: 'tsconfig.json', path: '/tsconfig.json', type: 'file', language: 'json', content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "outDir": "./dist",\n    "strict": true,\n    "esModuleInterop": true\n  },\n  "include": ["src"]\n}` },
];

const templatesMap: Record<string, FileNode[]> = {
  react: reactTemplate,
  nextjs: nextjsTemplate,
  html: htmlTemplate,
  node: nodeTemplate,
};


    }
    if (f.children) {
      return { ...f, children: addFileToTree(f.children, parentPath, newFile) };
    }
    return f;
  });
};

    }
    return f;
  });
};


/** Deep-clone template files (avoid shared reference mutations) */
export function getDefaultFiles(template: string): FileNode[] {
  const files = templatesMap[template] ?? reactTemplate;
  // structuredClone: native deep clone, faster than manual serialize/deserialize
  return structuredClone(files) as FileNode[];
}

export function findFirstFile(files: FileNode[]): FileNode | null {
  for (const f of files) {
    if (f.type === 'file') return f;
    if (f.children) {
      const found = findFirstFile(f.children);
      if (found) return found;
    }
  }
  return null;
}
