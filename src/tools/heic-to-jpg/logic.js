// HEIC to JPG: the choices on the page turned into resize plans and notes.

/** Resize options for "up to N pixels" (0 keeps the original size). Never enlarges. */
export function sizeOptions(maxSide) {
  const n = Number(maxSide) || 0;
  return n > 0 ? { mode: 'fit', width: n, height: n, noEnlarge: true } : { mode: 'fit' };
}

/** A note for files that hold more than one picture (bursts, Live Photos with stills, depth maps). */
export function burstNote(count) {
  return count > 1 ? `This file holds ${count} images, such as a burst or a Live Photo; the main photo was converted` : '';
}

/** "IMG_1234.HEIC" → "IMG_1234.jpg" (lower-case extension, the way most apps write it). */
export function convertedName(name, ext) {
  const base = String(name || 'photo').replace(/\.(heic|heif|hif|jpe?g|png|webp|gif|bmp|avif|tiff?)$/i, '') || 'photo';
  return `${base}.${ext}`;
}
