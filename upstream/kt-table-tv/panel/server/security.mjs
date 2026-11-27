import { createHash } from 'node:crypto';

export function requestUrl(target, origin) {
  if (typeof target !== 'string' || target.length > 4096 || !target.startsWith('/') || target.startsWith('//') || /[\\#\x00-\x20\x7f]/.test(target)) return null;
  try {
    const url = new URL(target, origin);
    if (url.origin !== origin || /[\\\x00-\x1f\x7f]/.test(decodeURIComponent(url.pathname))) return null;
    return url;
  } catch { return null; }
}

export function trustedApiRead(headers, origin) {
  return (!headers.origin || headers.origin === origin) && !['cross-site', 'same-site'].includes(headers['sec-fetch-site']);
}

export function contentSecurityPolicy(html = '', development = false) {
  const hashes = [...String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => !/\bsrc\s*=/i.test(match[1]))
    .map(match => `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  return [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
    `script-src 'self' ${development ? "'unsafe-inline'" : hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    `connect-src 'self'${development ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "frame-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function applySecurityHeaders(res, { development = false } = {}) {
  for (const [name, value] of Object.entries({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), usb=(), serial=(), payment=(), microphone=()',
    'Content-Security-Policy': contentSecurityPolicy('', development),
  })) res.setHeader(name, value);
}
