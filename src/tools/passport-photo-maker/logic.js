// Passport photo maker: the official sizes, the crop geometry and the checks.
// Nothing here touches the browser, so tests can import it.
//
// The tool only crops and resizes. It never changes the background or the face, because
// passport agencies reject photos that were retouched or edited with AI.

const KB = 1024;
const MB = 1024 * 1024;

/**
 * Document specs, from travel.state.gov (checked November 2026).
 * `head` is chin to top of hair as a share of the photo's height; `eyes` is the eye line
 * measured up from the bottom edge. Printed photos are `inches` square.
 */
export const DOCS = {
  'us-passport': {
    label: 'US passport',
    inches: 2,
    head: { min: 0.5, max: 0.6875 }, // 1 to 1 3/8 inches of 2
    eyes: { min: 0.5625, max: 0.6875 }, // 1 1/8 to 1 3/8 inches from the bottom
    digital: { minSide: 600, maxSide: 1200, minBytes: 54 * KB, maxBytes: 10 * MB },
    help: 'For renewing online or applying on paper. Printed photo: 2 × 2 inches, head 1 to 1⅜ inches from chin to top of hair. Online upload: a file between 54 KB and 10 MB.',
  },
  'us-visa': {
    label: 'US visa or Diversity Visa (DV) lottery',
    inches: 2,
    head: { min: 0.5, max: 0.69 },
    eyes: { min: 0.56, max: 0.69 },
    digital: { minSide: 600, maxSide: 600, maxBytes: 240 * KB },
    help: 'For the DS-160 visa form and the DV lottery entry. Digital photo: a square JPG of 600 × 600 pixels, no larger than 240 KB, head 50% to 69% of the height.',
  },
};

export const docFor = (id) => DOCS[id] || DOCS['us-passport'];

/**
 * Where to draw the guides, as shares of the frame measured from the top.
 * The eye line and head height aim for the middle of the allowed ranges; the eyes sit about
 * halfway between the chin and the top of the hair. With the chin on `chin`, the top of the
 * hair may be anywhere between `hairTop` and `hairBottom` and the head size is still within spec.
 */
export function guides(doc) {
  const head = (doc.head.min + doc.head.max) / 2;
  const eyes = 1 - (doc.eyes.min + doc.eyes.max) / 2;
  const chin = eyes + head / 2;
  const edge = 0.02; // keep the hair off the very edge of the photo
  return {
    eyes,
    chin,
    crown: eyes - head / 2,
    hairTop: Math.max(edge, chin - doc.head.max),
    hairBottom: chin - doc.head.min,
  };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** How far in you can zoom: until the crop is `minPixels` across, and never more than 8×. */
export function maxZoom(image, minPixels = 300) {
  return clamp(Math.min(image.width, image.height) / minPixels, 1, 8);
}

/**
 * The square part of the image that ends up in the photo.
 * view = { zoom, cx, cy }: zoom 1 shows the largest square that fits; cx, cy is its center in image pixels.
 * The square is always kept inside the image, so nothing ever has to be filled in.
 * Returns { sx, sy, size, zoom, cx, cy } with the view corrected to what was possible.
 */
export function cropSquare(image, view = {}) {
  const short = Math.min(image.width, image.height);
  const zoom = clamp(Number(view.zoom) || 1, 1, maxZoom(image));
  const size = short / zoom;
  const cx = clamp(Number.isFinite(view.cx) ? view.cx : image.width / 2, size / 2, image.width - size / 2);
  const cy = clamp(Number.isFinite(view.cy) ? view.cy : image.height / 2, size / 2, image.height - size / 2);
  return { sx: cx - size / 2, sy: cy - size / 2, size, zoom, cx, cy };
}

/** A good first guess: the largest square, centered sideways and resting against the top (heads are near the top). */
export function initialView(image) {
  const short = Math.min(image.width, image.height);
  return cropSquare(image, { zoom: 1, cx: image.width / 2, cy: image.height > image.width ? short / 2 + (image.height - short) * 0.15 : image.height / 2 });
}

/** Move the photo by a share of the frame (dx, dy of 1 = one whole frame). Dragging right shows more of the left. */
export function panBy(image, view, dx, dy) {
  const { size, zoom, cx, cy } = cropSquare(image, view);
  return cropSquare(image, { zoom, cx: cx - dx * size, cy: cy - dy * size });
}

/** Zoom to `zoom`, keeping the point at (fx, fy) of the frame (0–1 each) in place. */
export function zoomAt(image, view, zoom, fx = 0.5, fy = 0.5) {
  const before = cropSquare(image, view);
  const px = before.sx + fx * before.size;
  const py = before.sy + fy * before.size;
  const size = Math.min(image.width, image.height) / clamp(zoom, 1, maxZoom(image));
  return cropSquare(image, { zoom, cx: px + (0.5 - fx) * size, cy: py + (0.5 - fy) * size });
}

/**
 * The pixel size to save a crop at: as sharp as the photo allows, within the document's limits.
 * `enlarged` is true when the crop has fewer pixels than the minimum, so the result will look soft.
 */
export function outputSide(cropSize, digital) {
  const side = clamp(Math.floor(cropSize), digital.minSide, digital.maxSide);
  return { side, enlarged: cropSize < digital.minSide - 0.5 };
}

/**
 * Lay out photos on a print sheet. Sizes in inches; the result is in pixels.
 * The default is two 2 × 2 inch photos on a 4 × 6 inch print: a spare, and enough margin
 * that a photo lab trimming the edges of a borderless print never cuts into a photo.
 */
export function sheetLayout({ sheet = [6, 4], dpi = 300, inches = 2, count = 2, gap = 0.5 } = {}) {
  const side = Math.round(inches * dpi);
  const width = Math.round(sheet[0] * dpi);
  const height = Math.round(sheet[1] * dpi);
  const gapPx = Math.round(gap * dpi);
  const perRow = Math.max(1, Math.min(count, Math.floor((width + gapPx) / (side + gapPx))));
  const rows = Math.ceil(count / perRow);
  if (rows * side + (rows - 1) * gapPx > height) throw new RangeError('That many photos don’t fit on the sheet.');
  const top = Math.round((height - rows * side - (rows - 1) * gapPx) / 2);
  const photos = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const left = Math.round((width - inRow * side - (inRow - 1) * gapPx) / 2);
    photos.push({ x: left + (i % perRow) * (side + gapPx), y: top + row * (side + gapPx) });
  }
  return { width, height, side, photos };
}

/**
 * Write the print resolution into a JPG so that "print at actual size" comes out right
 * (600 pixels at 300 dpi = 2 inches). Browsers save JPGs without one. Only the standard
 * JFIF header is touched; anything else is returned unchanged.
 */
export function setJpegDpi(bytes, dpi) {
  const isJfif =
    bytes.length > 18 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0 &&
    bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46 && bytes[10] === 0;
  const d = Math.round(dpi);
  if (!isJfif || !(d > 0 && d < 65536)) return bytes;
  const out = bytes.slice();
  out[13] = 1; // units: dots per inch
  out[14] = d >> 8;
  out[15] = d & 0xff;
  out[16] = d >> 8;
  out[17] = d & 0xff;
  return out;
}

/** Does the file size suit the document's upload form? Returns { ok, problem }. */
export function sizeCheck(bytes, digital) {
  if (digital.minBytes && bytes < digital.minBytes) return { ok: false, problem: 'small' };
  if (digital.maxBytes && bytes > digital.maxBytes) return { ok: false, problem: 'large' };
  return { ok: true, problem: '' };
}

/**
 * Look at the background without changing it. `left` and `right` are RGBA pixel arrays
 * sampled from the top corners of the photo, where only the wall should be visible.
 * Returns { ok, light, even, brightness, spread }: brightness 0–255, spread = how much it varies.
 */
export function backgroundCheck(left, right) {
  const stats = (px) => {
    let sum = 0;
    let sq = 0;
    const n = Math.floor(px.length / 4);
    for (let i = 0; i < n * 4; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l;
      sq += l * l;
    }
    const mean = n ? sum / n : 0;
    return { mean, sd: n ? Math.sqrt(Math.max(0, sq / n - mean * mean)) : 0 };
  };
  const a = stats(left);
  const b = stats(right);
  const brightness = (a.mean + b.mean) / 2;
  const spread = Math.max(a.sd, b.sd, Math.abs(a.mean - b.mean) / 2);
  const light = brightness >= 165;
  const even = spread <= 14;
  return { ok: light && even, light, even, brightness: Math.round(brightness), spread: Math.round(spread) };
}

/** "us-passport" + "photo" → "us-passport-photo-1200x1200.jpg" */
export function fileName(docId, kind, ext, side = 0) {
  const id = DOCS[docId] ? docId : 'us-passport';
  return kind === 'sheet' ? `${id}-photos-4x6-print.${ext}` : `${id}-photo-${side}x${side}.${ext}`;
}
