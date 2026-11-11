// HEIC/HEIF support for every image tool. Safari opens these photos itself; elsewhere the
// decoder (about 1.5 MB) downloads the first time it's needed and runs in a background worker.

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

/** True when the first bytes say this is a HEIF file ("ftyp" box with a HEIF brand), whatever its name. */
export function isHeifHeader(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const text = String.fromCharCode(...bytes.slice(4, Math.min(bytes.length, 32)));
  if (!text.startsWith('ftyp')) return false;
  const major = text.slice(4, 8);
  if (major === 'avif' || major === 'avis') return false; // AVIF uses the same container; browsers open it natively
  return HEIF_BRANDS.includes(major) || HEIF_BRANDS.some((b) => text.slice(12).includes(b));
}

export function looksLikeHeic(file) {
  return /image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif|hif)$/i.test(file.name || '');
}

export async function sniffHeic(file) {
  try {
    return isHeifHeader(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  } catch {
    return false;
  }
}

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./heic-worker.js', import.meta.url));
  worker.onmessage = (e) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.error) job.reject(new Error(e.data.error));
    else job.resolve(e.data);
  };
  worker.onerror = (e) => {
    e.preventDefault?.();
    for (const job of pending.values()) job.reject(new Error('The HEIC decoder couldn’t start in this browser.'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function decodeInWorker(buffer) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, buffer }, [buffer]);
  });
}

function previewOf(canvas, max = 1600) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * scale));
  c.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => { c.width = c.height = 0; resolve(b); }, 'image/jpeg', 0.85));
}

/**
 * Decode a HEIC photo to a canvas. Returns the same shape as image-engine's decode(), plus:
 * `preview` (a small JPG for thumbnails, since most browsers can't show the original),
 * `count` (how many images the file holds) and `heavy` (free it after use; it's full size in memory).
 */
export async function decodeHeic(file) {
  const res = await decodeInWorker(await file.arrayBuffer());
  const canvas = document.createElement('canvas');
  canvas.width = res.width;
  canvas.height = res.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This photo is too large for this browser to open.');
  ctx.putImageData(new ImageData(res.data, res.width, res.height), 0, 0);
  const preview = await previewOf(canvas);
  return {
    source: canvas,
    width: res.width,
    height: res.height,
    count: res.count,
    alpha: res.alpha,
    preview,
    heavy: true,
    close: () => { canvas.width = 0; canvas.height = 0; },
  };
}
