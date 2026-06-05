/**
 * XSS Sanitisation utilities — production-grade
 *
 * Uses DOMPurify for HTML sanitization.
 * All AI-generated content MUST pass through sanitizeAiText or sanitizeHtml
 * before rendering in the DOM.
 */

// ─── DOMPurify lazy singleton ─────────────────────────────────────────────

type DOMPurifyType = typeof import('dompurify');
let _purify: DOMPurifyType | null = null;

async function getPurify(): Promise<DOMPurifyType> {
  if (_purify) return _purify;
  const mod = await import('dompurify');
  _purify = mod.default ?? (mod as unknown as DOMPurifyType);
  return _purify;
}

// ─── HTML sanitization ────────────────────────────────────────────────────

/** Safe HTML for rich content (chat messages, markdown output) */
export async function sanitizeHtml(html: string): Promise<string> {
  const DOMPurify = await getPurify();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'div', 'a', 'blockquote', 'hr', 'table', 'thead',
      'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'data-language'],
    FORCE_BODY: false,
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  });
}

/** Synchronous plain-text escape — no HTML allowed */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/** Strip all HTML tags — safe plain text extraction */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// ─── AI output sanitization ──────────────────────────────────────────────

/**
 * Sanitize AI-generated text for safe display.
 * Strips script tags and event handlers while preserving code blocks.
 */
export function sanitizeAiText(text: string): string {
  if (!text) return '';
  // Remove script tags and their content
  let safe = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handler attributes
  safe = safe.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  // Remove javascript: URLs
  safe = safe.replace(/javascript\s*:/gi, 'blocked:');
  // Remove data: URLs in dangerous contexts
  safe = safe.replace(/\bdata:\s*text\/html/gi, 'blocked:text/html');
  return safe;
}

// ─── Path validation ──────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /\.\./,                          // directory traversal
  /^\/etc\//,                      // system dirs
  /^\/proc\//,
  /^\/sys\//,
  /^\/dev\//,
  /node_modules\//,                // never overwrite deps
  /^[A-Z]:\\/,                     // Windows absolute paths
  /^\\\\/,                         // UNC paths
];

/** Validate a filepath from AI output — returns null if unsafe */
export function sanitizePath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const p = raw.trim().replace(/\\/g, '/');
  if (p.length > 260) return null;
  if (BLOCKED_PATTERNS.some(re => re.test(p))) return null;
  if (!p.startsWith('/') && !p.startsWith('./')) return null;
  return p;
}

// ─── URL validation ───────────────────────────────────────────────────────

/** Allow only http/https/blob URLs */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) return url;
    return null;
  } catch {
    return null; // invalid URL format
  }
}
