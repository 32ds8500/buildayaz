import JSZip from 'jszip';
import { FileNode, Project, getLanguage } from '../store/useStore';

function generateId(): string {
  return generateId();
}

// Binary dosya uzantıları - bunları atla
const binaryExtensions = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp', 'avif',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib',
  'class', 'jar', 'pyc',
  'db', 'sqlite', 'sqlite3',
]);

// Yok sayılacak klasörler
const ignoredFolders = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  '.cache', '.parcel-cache', '__pycache__', '.vscode',
  '.idea', 'coverage', '.turbo', '.vercel',
]);

function isBinary(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return binaryExtensions.has(ext);
}

function shouldIgnore(pathPart: string): boolean {
  return ignoredFolders.has(pathPart) || pathPart.startsWith('.');
}

function buildFileTree(flatFiles: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  // Tüm dosyaları sırala (klasörler önce)
  const sorted = [...flatFiles].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/').filter(Boolean);
    
    // Yok sayılacak klasör kontrolü
    if (parts.some(p => shouldIgnore(p))) continue;
    
    let currentPath = '';
    let currentArray = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath += '/' + part;

      if (isLast) {
        // Dosya ekle
        const fileNode: FileNode = {
          name: part,
          path: currentPath,
          type: 'file',
          content: file.content,
          language: getLanguage(part),
        };
        currentArray.push(fileNode);
      } else {
        // Klasör oluştur veya mevcut olanı bul
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap.set(currentPath, folder);
          currentArray.push(folder);
        }
        currentArray = folder.children!;
      }
    }
  }

  return root;
}

/**
 * ZIP dosyasını içe aktar
 */
export async function importFromZip(file: File): Promise<Project> {
  const zip = await JSZip.loadAsync(file);
  const flatFiles: { path: string; content: string }[] = [];

  // ZIP'teki tüm dosyaları oku
  const entries = Object.entries(zip.files);
  
  // Ortak prefix bul (bazı ZIP'ler tek klasör altında gelir)
  let commonPrefix = '';
  const filePaths = entries.filter(([, f]) => !f.dir).map(([p]) => p);
  if (filePaths.length > 0) {
    const firstParts = filePaths[0].split('/');
    if (firstParts.length > 1) {
      const candidatePrefix = firstParts[0] + '/';
      if (filePaths.every(p => p.startsWith(candidatePrefix))) {
        commonPrefix = candidatePrefix;
      }
    }
  }

  for (const [path, zipEntry] of entries) {
    if (zipEntry.dir) continue;
    
    // Ortak prefix'i kaldır
    const cleanPath = commonPrefix ? path.replace(commonPrefix, '') : path;
    if (!cleanPath) continue;
    
    const fileName = cleanPath.split('/').pop() || '';
    
    // Binary dosyaları atla
    if (isBinary(fileName)) continue;
    
    // Yok sayılacak klasörleri atla
    const pathParts = cleanPath.split('/');
    if (pathParts.some(p => shouldIgnore(p))) continue;

    try {
      const content = await zipEntry.async('string');
      // Çok büyük dosyaları atla (> 500KB)
      if (content.length > 500000) continue;
      flatFiles.push({ path: cleanPath, content });
    } catch {
      // Binary veya okunamayan dosyayı atla
    }
  }

  const projectName = file.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ');
  const files = buildFileTree(flatFiles);

  return {
    id: generateId(),
    name: projectName,
    description: `ZIP dosyasından içe aktarıldı (${flatFiles.length} dosya)`,
    template: 'imported',
    files,
    createdAt: Date.now(),
  };
}

/**
 * Tekil dosyaları içe aktar
 */
export async function importFromFiles(fileList: FileList): Promise<Project> {
  const flatFiles: { path: string; content: string }[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    
    // Binary dosyaları atla
    if (isBinary(file.name)) continue;
    
    // Çok büyük dosyaları atla
    if (file.size > 500000) continue;

    try {
      const content = await readFileAsText(file);
      // webkitRelativePath klasörden seçilince dolu olur
      const path = (file as any).webkitRelativePath || file.name;
      
      // Yok sayılacak klasörleri atla
      const pathParts = path.split('/');
      if (pathParts.some((p: string) => shouldIgnore(p))) continue;
      
      // İlk klasör adını kaldır (klasör seçilince gelen ana klasör)
      // eslint-disable-next-line prefer-const
      let cleanPath = path;
      if (pathParts.length > 1) {
        cleanPath = pathParts.slice(1).join('/');
      }
      
      flatFiles.push({ path: cleanPath || file.name, content });
    } catch (err) {
      console.debug('[importService] Skipping unreadable file:', err);
      // Okunamayan dosyayı atla
    }
  }

  // Proje adını belirle
  let projectName = 'İçe Aktarılan Proje';
  if (fileList.length > 0) {
    const firstPath = (fileList[0] as any).webkitRelativePath || '';
    if (firstPath) {
      projectName = firstPath.split('/')[0] || projectName;
    }
  }

  const files = buildFileTree(flatFiles);

  return {
    id: generateId(),
    name: projectName,
    description: `Dosyalardan içe aktarıldı (${flatFiles.length} dosya)`,
    template: 'imported',
    files,
    createdAt: Date.now(),
  };
}

/**
 * Dosya içeriğini text olarak oku
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Projeyi ZIP olarak dışa aktar
 */
export async function exportProjectAsZip(project: Project): Promise<void> {
  const zip = new JSZip();

  function addFilesToZip(nodes: FileNode[], basePath: string = '') {
    for (const node of nodes) {
      const fullPath = basePath ? `${basePath}/${node.name}` : node.name;
      if (node.type === 'file') {
        zip.file(fullPath, node.content || '');
      } else if (node.children) {
        addFilesToZip(node.children, fullPath);
      }
    }
  }

  addFilesToZip(project.files);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
