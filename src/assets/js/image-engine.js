// Decode, resize and encode images with the browser's own canvas. Nothing leaves the device.
// Re-encoding through a canvas also drops metadata such as camera details and GPS location.

import { OUTPUT_TYPES } from './image-core.js';
import { looksLikeHeic, sniffHeic, decodeHeic } from './heic.js';

/**
 * Open an image file. Returns { source, width, height, close() } where `source` can be drawn on a canvas.
 * Photos are turned upright using their EXIF orientation. HEIC photos fall back to a bundled decoder
 * in browsers that can't open them (everything except Safari), so every image tool accepts iPhone photos.
 */
export async function decode(file) {
  if (typeof createImageBitmap === 'function' && !/svg/.test(file.type)) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    } catch {
      /* fall through to <img>, which handles a few more formats in some browsers */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      // SVGs without a set size
      width = 1024;
      height = 1024;
    }
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    if (looksLikeHeic(file) || (await sniffHeic(file))) return decodeHeic(file);
    throw new Error('This file couldn’t be opened as an image.');
  }
}

function canvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Draw with good quality when shrinking a lot: halve in steps instead of one big jump. */
function drawSmooth(ctx, source, sx, sy, sw, sh, dx, dy, dw, dh) {
  let src = source;
  let [cx, cy, cw, ch] = [sx, sy, sw, sh];
  while (cw / dw > 2 && ch / dh > 2) {
    const tw = Math.max(Math.round(cw / 2), Math.round(dw));
    const th = Math.max(Math.round(ch / 2), Math.round(dh));
    const tmp = canvas(tw, th);
    const t = tmp.getContext('2d');
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = 'high';
    t.drawImage(src, cx, cy, cw, ch, 0, 0, tw, th);
    src = tmp;
    [cx, cy, cw, ch] = [0, 0, tw, th];
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, cx, cy, cw, ch, dx, dy, dw, dh);
}

/**
 * Render a decoded image according to a plan from planResize().
 * `background` fills the canvas first (needed for JPG, which has no transparency, and for borders).
 */
export function render(decoded, plan, { background = null } = {}) {
  const c = canvas(plan.width, plan.height);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('This browser couldn’t create an image that large.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, plan.width, plan.height);
  }
  drawSmooth(ctx, decoded.source, plan.sx, plan.sy, plan.sw, plan.sh, plan.dx, plan.dy, plan.dw, plan.dh);
  return c;
}

/** Encode a canvas as a file. Quality (0–1) applies to JPG and WebP. */
export function encode(c, type, quality = 0.9) {
  return new Promise((resolve, reject) => {
    try {
      c.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('This browser couldn’t create the image.'));
          if (blob.type !== type) return reject(new Error(`This browser can’t save ${OUTPUT_TYPES[type]?.label || type} images. Choose another format.`));
          resolve(blob);
        },
        type,
        quality,
      );
    } catch (err) {
      reject(err.name === 'SecurityError' ? new Error('This SVG uses features browsers won’t convert (like embedded web content).') : err);
    }
  });
}

const support = new Map();
/** Can this browser save this format? (Older Safari can't write WebP, for example.) */
export function canEncode(type) {
  if (!support.has(type)) {
    support.set(
      type,
      new Promise((resolve) => {
        try {
          canvas(1, 1).toBlob((b) => resolve(!!b && b.type === type), type);
        } catch {
          resolve(false);
        }
      }),
    );
  }
  return support.get(type);
}

/** A sample "photo" for people who want to try a tool without their own files. */
export async function sampleImage({ type = 'image/jpeg', quality = 0.92, transparent = false } = {}) {
  const W = 2400;
  const H = 1600;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2b5c9e');
  sky.addColorStop(0.55, '#f2a65a');
  sky.addColorStop(1, '#f7d488');
  if (transparent) {
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W * 0.46, H * 0.46, 0, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(W * 0.68, H * 0.5, 170, 0, Math.PI * 2);
  ctx.fill();
  const hills = [['#3d5a3a', 0.72, 120], ['#2f4730', 0.8, 160], ['#22351f', 0.9, 90]];
  for (const [color, base, amp] of hills) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * base - Math.sin(x / 260 + base * 9) * amp - Math.sin(x / 90) * 18);
    ctx.lineTo(W, H);
    ctx.fill();
  }
  // fine texture so compression has something to work on
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H * 0.7, 2, 2);
  }
  const blob = await encode(c, type, quality);
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `sample-landscape.${ext}`, { type, lastModified: Date.now() });
}
