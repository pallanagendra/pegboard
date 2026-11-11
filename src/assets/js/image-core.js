// Image helpers that don't touch the browser, so they can be unit tested in Node.

export const OUTPUT_TYPES = {
  'image/jpeg': { ext: 'jpg', label: 'JPG', lossy: true, alpha: false },
  'image/png': { ext: 'png', label: 'PNG', lossy: false, alpha: true },
  'image/webp': { ext: 'webp', label: 'WebP', lossy: true, alpha: true },
};

// Browsers can't reliably draw canvases bigger than this (iOS Safari is the strictest).
export const MAX_SIDE = 16384;
export const MAX_PIXELS = 16384 * 16384 / 4; // ~67 megapixels

const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif', hif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', ico: 'image/x-icon' };

/** The file's image type, falling back to its extension (some systems report an empty type). */
export function detectType(name, type) {
  if (type && type.startsWith('image/')) return type === 'image/jpg' ? 'image/jpeg' : type;
  const ext = String(name || '').toLowerCase().split('.').pop();
  return EXT_TYPES[ext] || '';
}

export function isImage(name, type) {
  return detectType(name, type) !== '';
}

/** "412 KB", "3.2 MB" — binary units, like most operating systems show. */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Percentage change from before to after: negative = smaller. */
export function sizeChange(before, after) {
  if (!before) return 0;
  return Math.round(((after - before) / before) * 100);
}

/**
 * Which type to save as. `choice` is "same" or a MIME type.
 * "same" keeps JPG, PNG and WebP; anything else (GIF, BMP, AVIF, SVG, HEIC…) becomes `fallback`.
 */
export function outputType(inputType, choice = 'same', fallback = 'image/png') {
  if (choice && choice !== 'same') return choice;
  return OUTPUT_TYPES[inputType] ? inputType : fallback;
}

/** "Holiday photo.HEIC" + image/jpeg + "-1080x720" → "Holiday photo-1080x720.jpg" */
export function outputName(name, type, suffix = '') {
  const base = String(name || 'image').replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'image';
  return `${base}${suffix}.${OUTPUT_TYPES[type]?.ext || 'png'}`;
}

/** Make names unique for a ZIP: "a.jpg", "a.jpg" → "a.jpg", "a (2).jpg". */
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    const candidate = dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/**
 * Work out the output canvas and where to draw the source on it.
 *
 * opts.mode:
 *   "fit"      keep proportions, no larger than width × height (either may be empty)
 *   "cover"    exactly width × height, cropping the overflow from the center
 *   "contain"  exactly width × height, adding borders
 *   "stretch"  exactly width × height, ignoring proportions
 *   "percent"  scale by opts.percent
 * opts.noEnlarge  for "fit": never make the image bigger than it is
 *
 * Returns { width, height, sx, sy, sw, sh, dx, dy, dw, dh } — the last eight are drawImage arguments.
 */
export function planResize(src, opts = {}) {
  const w0 = positive(src.width);
  const h0 = positive(src.height);
  if (!w0 || !h0) throw new RangeError('The image has no size.');
  const W = Math.round(positive(opts.width));
  const H = Math.round(positive(opts.height));
  let mode = opts.mode || 'fit';
  if ((mode === 'cover' || mode === 'contain' || mode === 'stretch') && !(W && H)) mode = 'fit';

  const full = { sx: 0, sy: 0, sw: w0, sh: h0 };
  let plan;

  if (mode === 'percent') {
    const p = positive(opts.percent) || 100;
    const width = Math.max(1, Math.round((w0 * p) / 100));
    const height = Math.max(1, Math.round((h0 * p) / 100));
    plan = { width, height, ...full, dx: 0, dy: 0, dw: width, dh: height };
  } else if (mode === 'stretch') {
    plan = { width: W, height: H, ...full, dx: 0, dy: 0, dw: W, dh: H };
  } else if (mode === 'cover') {
    const scale = Math.max(W / w0, H / h0);
    const sw = W / scale;
    const sh = H / scale;
    plan = { width: W, height: H, sx: (w0 - sw) / 2, sy: (h0 - sh) / 2, sw, sh, dx: 0, dy: 0, dw: W, dh: H };
  } else if (mode === 'contain') {
    const scale = Math.min(W / w0, H / h0);
    const dw = Math.max(1, Math.round(w0 * scale));
    const dh = Math.max(1, Math.round(h0 * scale));
    plan = { width: W, height: H, ...full, dx: Math.floor((W - dw) / 2), dy: Math.floor((H - dh) / 2), dw, dh };
  } else {
    let scale = 1;
    if (W && H) scale = Math.min(W / w0, H / h0);
    else if (W) scale = W / w0;
    else if (H) scale = H / h0;
    if (opts.noEnlarge) scale = Math.min(scale, 1);
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    plan = { width, height, ...full, dx: 0, dy: 0, dw: width, dh: height };
  }

  if (plan.width > MAX_SIDE || plan.height > MAX_SIDE || plan.width * plan.height > MAX_PIXELS) {
    throw new RangeError(`${plan.width} × ${plan.height} is too large for a browser to create. Choose a smaller size.`);
  }
  return plan;
}

/**
 * Find the highest quality whose file fits within targetBytes.
 * `encode(quality)` must resolve to something with a `.size` (a Blob).
 * Returns { blob, quality, reached }.
 */
export async function fitToSize(encode, targetBytes, { min = 0.05, max = 0.95, steps = 7 } = {}) {
  let best = null;
  let lo = min;
  let hi = max;
  const top = await encode(hi);
  if (top.size <= targetBytes) return { blob: top, quality: hi, reached: true };
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const blob = await encode(mid);
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid, reached: true };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (best) return best;
  const floor = await encode(min);
  return { blob: floor, quality: min, reached: floor.size <= targetBytes };
}
