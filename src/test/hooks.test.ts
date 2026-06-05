/**
 * Custom Hook Tests
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useZipExport } from '../hooks/useZipExport';

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      private files: Record<string, string> = {};
      file(path: string, content: string) { this.files[path] = content; }
      folder(name: string) { return this; }
      generateAsync() {
        return Promise.resolve(new Blob(['mock-zip-content'], { type: 'application/zip' }));
      }
    },
  };
});

// Mock URL.createObjectURL
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

describe('useZipExport', () => {
  it('returns exportZip function and isExporting state', () => {
    const { result } = renderHook(() => useZipExport());
    expect(typeof result.current.exportZip).toBe('function');
    expect(result.current.isExporting).toBe(false);
  });

  it('exportZip creates download link', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));

    const { result } = renderHook(() => useZipExport());
    await result.current.exportZip('test-project', [
      { name: 'index.html', path: '/index.html', type: 'file', content: '<html></html>' },
    ]);

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
