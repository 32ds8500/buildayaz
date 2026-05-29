/**
 * XSS Sanitisation utilities
 * Uses DOMPurify for HTML, manual escape for attribute values
 */
import DOMPurify from 'dompurify';

/** Sanitise HTML string — uses DOMPurify */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b','i','em','strong','code','pre','br','p','ul','ol','li','h1','h2','h3','h4','span','div','a','blockquote','hr'],
    ALLOWED_ATTR: ['class','href','target','rel'],
    FORCE_BODY: false,
  });
}

/** Synchronous plain-text escape (no HTML tags allowed) */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Strip all HTML tags — safe plain text extraction */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Validate filepath — no traversal, reasonable length */
export function sanitizePath(raw: string): string | null {
  const p = raw.trim().replace(/\\/g, '/');
  if (p.length > 260) return null;
  if (/\.\./.test(p)) return null;
  if (/^\/etc\/|^\/proc\/|^\/sys\/|^\/dev\/|node_modules\//.test(p)) return null;
  if (!p.startsWith('/') && !p.startsWith('./')) return null;
  return p;
}
