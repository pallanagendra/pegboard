// Base64 for text (as UTF-8, so accents and emoji survive) and for raw bytes.

export function bytesToBase64(bytes, { urlSafe = false, wrap = 0 } = {}) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (wrap > 0) b64 = b64.replace(new RegExp(`(.{${wrap}})(?=.)`, 'g'), '$1\n');
  return b64;
}

export function encodeText(text, options) {
  return bytesToBase64(new TextEncoder().encode(String(text ?? '')), options);
}

/**
 * Read Base64 (standard or URL-safe, with or without padding, line breaks or a data: URL prefix).
 * Returns { bytes, mime, urlSafe } or { error }.
 */
export function parseBase64(input) {
  let s = String(input ?? '').trim();
  let mime = null;
  const data = s.match(/^data:([^;,]*)((?:;[^;,]*)*),/i);
  if (data) {
    if (!/;base64/i.test(data[2])) return { error: 'This data URL isn’t Base64 (it has no “;base64” before the comma), so there’s nothing to decode.' };
    mime = data[1] || null;
    s = s.slice(data[0].length);
  }
  s = s.replace(/\s+/g, '');
  if (!s) return { error: 'Paste some Base64 to decode.' };
  const urlSafe = /[-_]/.test(s);
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bad = s.match(/[^A-Za-z0-9+/=]/);
  if (bad) return { error: `“${bad[0]}” isn’t a Base64 character. Base64 only uses A–Z, a–z, 0–9, + and / (or - and _), with up to two = signs at the end.` };
  if (/=+[^=]/.test(s)) return { error: 'An “=” appears in the middle. In Base64 it only pads the very end, so two pieces may have been pasted together.' };
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) return { error: 'The length doesn’t work out: one character is missing or extra, so part of it may have been cut off when copying.' };
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime, urlSafe };
}

/** The bytes as text if they're valid UTF-8 and look like text; otherwise { binary: true }. */
export function bytesToText(bytes) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { binary: true };
  }
  // NUL bytes or lots of control characters mean it's a file, not text
  const controls = (text.match(/[\u0000-\u0008\u000e-\u001f]/g) || []).length;
  if (text.includes('\u0000') || controls > Math.max(2, text.length * 0.02)) return { binary: true };
  return { text };
}

const SIGNATURES = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: 'image/png', ext: 'png', label: 'PNG image' },
  { bytes: [0xff, 0xd8, 0xff], type: 'image/jpeg', ext: 'jpg', label: 'JPEG image' },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: 'image/gif', ext: 'gif', label: 'GIF image' },
  { bytes: [0x25, 0x50, 0x44, 0x46], type: 'application/pdf', ext: 'pdf', label: 'PDF document' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: 'application/zip', ext: 'zip', label: 'ZIP archive (or an Office file)' },
  { bytes: [0x1f, 0x8b], type: 'application/gzip', ext: 'gz', label: 'Gzip file' },
  { bytes: [0x00, 0x00, 0x01, 0x00], type: 'image/x-icon', ext: 'ico', label: 'icon file' },
  { bytes: [0x42, 0x4d], type: 'image/bmp', ext: 'bmp', label: 'BMP image' },
  { bytes: [0x49, 0x44, 0x33], type: 'audio/mpeg', ext: 'mp3', label: 'MP3 audio' },
  { bytes: [0x4f, 0x67, 0x67, 0x53], type: 'audio/ogg', ext: 'ogg', label: 'Ogg audio' },
];

/** Guess a file type from its first bytes (and a data: URL type when given). */
export function sniff(bytes, mime = null) {
  const at = (offset, list) => list.every((b, i) => bytes[offset + i] === b);
  for (const s of SIGNATURES) if (at(0, s.bytes)) return s;
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { type: 'image/webp', ext: 'webp', label: 'WebP image' };
  if (at(4, [0x66, 0x74, 0x79, 0x70])) return { type: 'video/mp4', ext: 'mp4', label: 'MP4 video (or similar)' };
  if (mime) return { type: mime, ext: (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin', label: `${mime} file` };
  return { type: 'application/octet-stream', ext: 'bin', label: 'binary data' };
}

/** How much bigger Base64 makes something: 4 characters for every 3 bytes. */
export function encodedLength(byteCount) {
  return Math.ceil(byteCount / 3) * 4;
}
