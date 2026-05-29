import { describe, it, expect } from 'vitest';
import { getLanguage, findFirstFile, getDefaultFiles } from '../store/projectUtils';

describe('getLanguage', () => {
  it('maps extensions correctly', () => {
    expect(getLanguage('App.tsx')).toBe('typescript');
    expect(getLanguage('style.css')).toBe('css');
    expect(getLanguage('README.md')).toBe('markdown');
    expect(getLanguage('unknown.xyz')).toBe('plaintext');
  });
});

describe('findFirstFile', () => {
  it('finds the first file in a tree', () => {
    const files = getDefaultFiles('react');
    const first = findFirstFile(files);
    expect(first).not.toBeNull();
    expect(first?.type).toBe('file');
  });
});

describe('getDefaultFiles', () => {
  it('returns deep-cloned files', () => {
    const a = getDefaultFiles('react');
    const b = getDefaultFiles('react');
    expect(a).not.toBe(b);  // different references
    expect(a[0]).not.toBe(b[0]);
  });

  it('falls back to react template for unknown', () => {
    const files = getDefaultFiles('unknown-template');
    expect(files.length).toBeGreaterThan(0);
  });
});
