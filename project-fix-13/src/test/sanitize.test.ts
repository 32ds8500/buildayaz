import { describe, it, expect } from 'vitest';
import { escapeHtml, stripHtml, sanitizePath } from '../shared/utils/sanitize';

describe('escapeHtml', () => {
  it('escapes dangerous characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(escapeHtml('"quoted"')).toContain('&quot;');
  });
});

describe('stripHtml', () => {
  it('removes all tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
});

describe('sanitizePath', () => {
  it('blocks traversal', () => {
    expect(sanitizePath('../etc/passwd')).toBeNull();
    expect(sanitizePath('/etc/passwd')).toBeNull();
    expect(sanitizePath('node_modules/evil')).toBeNull();
  });

  it('allows valid paths', () => {
    expect(sanitizePath('/src/components/Foo.tsx')).toBe('/src/components/Foo.tsx');
    expect(sanitizePath('./src/App.tsx')).toBe('./src/App.tsx');
  });
});
