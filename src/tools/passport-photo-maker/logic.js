// Passport photo maker: the official sizes, the crop geometry and the checks.
// Nothing here touches the browser, so tests can import it.
//
// The tool only crops and resizes. It never changes the background or the face, because
// passport agencies reject photos that were retouched or edited with AI.

const KB = 1024;
const MB = 1024 * 1024;
const MM = 1 / 25.4; // millimetres to inches

/**
 * Document specs, each from the issuing government's own guidance (checked November 2026).
 *
 *   ratio      width : height of the photo
 *   print      printed size in inches (null when the document only takes an upload), and how many fit on the sheet
 *   head       chin to top of head as a share of the photo's height
 *   topOf      what "top of head" means for this document: the hair, or the skull under it (the crown)
 *   eyes       eye line measured up from the bottom edge, where the document gives one;
 *              otherwise crownGap says how far below the top edge the top of the head should sit
 *   file       the saved photo: allowed pixel widths, size limits, and whether it's meant for an online form
 *
 * Canada is left out on purpose: it only accepts photos taken by a commercial photographer.
 */
export const DOCS = {
  'us-passport': {
    label: 'United States: passport',
    ratio: [1, 1],
    print: { inches: [2, 2], label: '2 × 2 in', count: 2 },
    head: { min: 0.5, max: 0.6875 }, // 1 to 1 3/8 inches of 2
    topOf: 'hair',
    eyes: { min: 0.5625, max: 0.6875 }, // 1 1/8 to 1 3/8 inches from the bottom
    file: { minWidth: 600, maxWidth: 1200, minBytes: 54 * KB, maxBytes: 10 * MB, upload: true },
    background: 'Plain white or off-white background',
    glasses: 'No glasses',
    recent: 'Taken in the last 6 months',
    help: 'For renewing online or applying on paper. Printed photo: 2 × 2 inches, head 1 to 1⅜ inches from chin to top of hair. Online upload: a file between 54 KB and 10 MB.',
  },
  'us-visa': {
    label: 'United States: visa or Diversity Visa (DV) lottery',
    ratio: [1, 1],
    print: { inches: [2, 2], label: '2 × 2 in', count: 2 },
    head: { min: 0.5, max: 0.69 },
    topOf: 'hair',
    eyes: { min: 0.56, max: 0.69 },
    file: { minWidth: 600, maxWidth: 600, maxBytes: 240 * KB, upload: true },
    background: 'Plain white or off-white background',
    glasses: 'No glasses',
    recent: 'Taken in the last 6 months',
    help: 'For the DS-160 visa form and the DV lottery entry. Digital photo: a square JPG of 600 × 600 pixels, no larger than 240 KB, head 50% to 69% of the height.',
  },
  'in-passport': {
    label: 'India: passport',
    ratio: [7, 9],
    print: null,
    head: { min: 0.8, max: 0.85 },
    topOf: 'hair',
    crownGap: 0.05,
    file: { minWidth: 630, maxWidth: 630, maxBytes: 250 * KB, upload: true },
    background: 'Plain white background',
    glasses: 'No glasses',
    recent: 'A recent photo that looks like you now',
    help: 'For uploading with a Passport Seva application. Digital photo: 630 × 810 pixels, white background, face filling 80% to 85% of the photo.',
    note: 'India’s guideline doesn’t say how the 80% to 85% is measured. The guides here measure from the top of your hair to your chin, the whole head it asks you to show.',
  },
  'uk-passport': {
    label: 'United Kingdom: passport (printed photos)',
    ratio: [7, 9],
    print: { inches: [35 * MM, 45 * MM], label: '35 × 45 mm', count: 3 },
    head: { min: 29 / 45, max: 34 / 45 },
    topOf: 'head',
    crownGap: 0.09,
    file: { minWidth: 827, maxWidth: 827, upload: false }, // 35 mm at 600 dpi
    background: 'Plain cream or light grey background',
    glasses: 'Glasses off if you can; otherwise no glare and no tinted lenses',
    recent: 'Taken in the last month',
    help: 'For a paper application. Printed photo: 45 mm high by 35 mm wide, 29 to 34 mm from chin to the top of the head (not the hair).',
    note: 'Applying online? Don’t use this: upload your original, uncropped photo and the passport service crops it for you. For paper forms the photos must be professionally printed; HM Passport Office says home prints are unlikely to be good enough.',
  },
  'au-passport': {
    label: 'Australia: passport',
    ratio: [7, 9],
    print: { inches: [35 * MM, 45 * MM], label: '35 × 45 mm', count: 3 },
    head: { min: 32 / 45, max: 36 / 45 },
    topOf: 'head',
    crownGap: 0.07,
    file: { minWidth: 827, maxWidth: 827, upload: false },
    background: 'Plain white or light grey background',
    glasses: 'No glasses',
    recent: 'Taken in the last 6 months',
    help: 'Printed photo: 35 to 40 mm wide by 45 to 50 mm high, 32 to 36 mm from chin to the top of the head (not the hair).',
    note: 'Have the sheet printed at a photo lab or kiosk on glossy paper. The Australian Passport Office doesn’t accept inkjet prints.',
  },
  'schengen-visa': {
    label: 'Schengen visa (Europe)',
    ratio: [7, 9],
    print: { inches: [35 * MM, 45 * MM], label: '35 × 45 mm', count: 3 },
    head: { min: 32 / 45, max: 36 / 45 },
    topOf: 'head',
    crownGap: 0.07,
    file: { minWidth: 827, maxWidth: 827, upload: false },
    background: 'Plain light background (many consulates ask for white or light grey)',
    glasses: 'Glasses off if you can; otherwise no glare and no tinted lenses',
    recent: 'Taken in the last 6 months',
    help: 'Printed photo: 35 × 45 mm, face 32 to 36 mm from chin to the top of the head, about 70% to 80% of the height.',
    note: 'The size is the same for every Schengen country, but the background colour and upload rules differ a little between consulates. Check the page of the one you’re applying to.',
  },
};

export const docFor = (id) => DOCS[id] || DOCS['us-passport'];

/** Width divided by height. */
export const aspect = (doc) => doc.ratio[0] / doc.ratio[1];

/**
 * Where to draw the guides, as shares of the frame's height measured from the top.
 * The head height aims for the middle of the allowed range. With the chin on `chin`, the top
 * of the head may be anywhere between `hairTop` and `hairBottom` and the head size is still within spec.
 */
export function guides(doc) {
  const head = (doc.head.min + doc.head.max) / 2;
  // the eyes sit about halfway between the chin and the top of the head
  const eyes = doc.eyes ? 1 - (doc.eyes.min + doc.eyes.max) / 2 : doc.crownGap + head / 2;
  const chin = eyes + head / 2;
  const edge = 0.02; // keep the head off the very edge of the photo
  return {
    eyes,
    chin,
    crown: eyes - head / 2,
    hairTop: Math.max(edge, chin - doc.head.max),
    hairBottom: chin - doc.head.min,
  };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** The largest crop of this shape (width ÷ height) that fits in the image. */
function fullCrop(image, ratio) {
  const sh = Math.min(image.height, image.width / ratio);
  return { sw: sh * ratio, sh };
}

/** How far in you can zoom: until the crop is `minPixels` wide, and never more than 8×. */
export function maxZoom(image, ratio = 1, minPixels = 300) {
  return clamp(fullCrop(image, ratio).sw / minPixels, 1, 8);
}

/**
 * The part of the image that ends up in the photo.
 * view = { zoom, cx, cy }: zoom 1 shows the largest crop that fits; cx, cy is its center in image pixels.
 * The crop is always kept inside the image, so nothing ever has to be filled in.
 * Returns { sx, sy, sw, sh, zoom, cx, cy } with the view corrected to what was possible.
 */
export function cropRect(image, view = {}, ratio = 1) {
  const full = fullCrop(image, ratio);
  const zoom = clamp(Number(view.zoom) || 1, 1, maxZoom(image, ratio));
  const sw = full.sw / zoom;
  const sh = full.sh / zoom;
  const cx = clamp(Number.isFinite(view.cx) ? view.cx : image.width / 2, sw / 2, image.width - sw / 2);
  const cy = clamp(Number.isFinite(view.cy) ? view.cy : image.height / 2, sh / 2, image.height - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, zoom, cx, cy };
}

/** A good first guess: the largest crop, centered sideways and nearer the top (heads are near the top). */
export function initialView(image, ratio = 1) {
  const { sh } = fullCrop(image, ratio);
  return cropRect(image, { zoom: 1, cx: image.width / 2, cy: sh / 2 + (image.height - sh) * 0.15 }, ratio);
}

/** Move the photo by a share of the frame (dx, dy of 1 = one whole frame). Dragging right shows more of the left. */
export function panBy(image, view, dx, dy, ratio = 1) {
  const { sw, sh, zoom, cx, cy } = cropRect(image, view, ratio);
  return cropRect(image, { zoom, cx: cx - dx * sw, cy: cy - dy * sh }, ratio);
}

/** Zoom to `zoom`, keeping the point at (fx, fy) of the frame (0–1 each) in place. */
export function zoomAt(image, view, zoom, fx = 0.5, fy = 0.5, ratio = 1) {
  const before = cropRect(image, view, ratio);
  const px = before.sx + fx * before.sw;
  const py = before.sy + fy * before.sh;
  const full = fullCrop(image, ratio);
  const z = clamp(zoom, 1, maxZoom(image, ratio));
  return cropRect(image, { zoom: z, cx: px + (0.5 - fx) * (full.sw / z), cy: py + (0.5 - fy) * (full.sh / z) }, ratio);
}

/**
 * The pixel size to save a crop at: as sharp as the photo allows, within the document's limits.
 * `enlarged` is true when the crop has fewer pixels than the minimum, so the result will look soft.
 */
export function outputSize(cropWidth, doc) {
  const width = clamp(Math.floor(cropWidth), doc.file.minWidth, doc.file.maxWidth);
  return { width, height: Math.round((width * doc.ratio[1]) / doc.ratio[0]), enlarged: cropWidth < doc.file.minWidth - 0.5 };
}

/** Print resolution to write into the file so it prints at the document's size (0 when it isn't printed). */
export function printDpi(width, doc) {
  return doc.print ? Math.round(width / doc.print.inches[0]) : 0;
}

/**
 * Lay out photos in one row on a print sheet. Sizes in inches; the result is in pixels.
 * The default is two 2 × 2 inch photos on a 4 × 6 inch print: a spare, and enough margin
 * that a photo lab trimming the edges of a borderless print never cuts into a photo.
 */
export function sheetLayout({ sheet = [6, 4], dpi = 300, photo = [2, 2], count = 2, gap = 0.5, margin = 0.25 } = {}) {
  const w = Math.round(photo[0] * dpi);
  const h = Math.round(photo[1] * dpi);
  const width = Math.round(sheet[0] * dpi);
  const height = Math.round(sheet[1] * dpi);
  const gapPx = Math.round(gap * dpi);
  const marginPx = Math.round(margin * dpi);
  const row = count * w + (count - 1) * gapPx;
  if (count < 1 || row > width - 2 * marginPx || h > height - 2 * marginPx) throw new RangeError('That many photos don’t fit on the sheet.');
  const left = Math.round((width - row) / 2);
  const top = Math.round((height - h) / 2);
  return { width, height, w, h, photos: Array.from({ length: count }, (_, i) => ({ x: left + i * (w + gapPx), y: top })) };
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
export function sizeCheck(bytes, file) {
  if (file.minBytes && bytes < file.minBytes) return { ok: false, problem: 'small' };
  if (file.maxBytes && bytes > file.maxBytes) return { ok: false, problem: 'large' };
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

/** "uk-passport" + "photo" → "uk-passport-photo-827x1063.jpg" */
export function fileName(docId, kind, ext, width = 0, height = 0) {
  const id = DOCS[docId] ? docId : 'us-passport';
  return kind === 'sheet' ? `${id}-photos-4x6-print.${ext}` : `${id}-photo-${width}x${height}.${ext}`;
}
