/**
 * useZipExport — Custom hook for project ZIP download
 */
import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import type { FileNode } from '../store/types';
import { logger } from '../core/llm/logging/logger';

const log = logger.forModule('useZipExport');

export function useZipExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportZip = useCallback(async (
    projectName: string,
    files: FileNode[],
  ): Promise<void> => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      addFilesToZip(zip, files);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      log.error('ZIP export failed', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return { exportZip, isExporting };
}

function addFilesToZip(zip: JSZip, nodes: FileNode[], prefix = '') {
  for (const node of nodes) {
    const nodePath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
      zip.file(nodePath, node.content ?? '');
    } else if (node.children) {
      addFilesToZip(zip, node.children, nodePath);
    }
  }
}
