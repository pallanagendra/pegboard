import { decode, render, encode } from '../../assets/js/image-engine.js';
import { isImage, formatBytes, fitToSize } from '../../assets/js/image-core.js';
import { readForm, persistForm, downloadBlob, toast, debounce } from '../../assets/js/ui.js';
import { DOCS, docFor, aspect, guides, cropRect, initialView, panBy, zoomAt, maxZoom, outputSize, printDpi, sheetLayout, setJpegDpi, sizeCheck, backgroundCheck, fileName } from './logic.js';

const root = document.querySelector('[data-tool]');
const $ = (sel) => root.querySelector(sel);
const form = $('[data-form]');
const docSelect = $('[data-docs]');
const docHelp = $('[data-doc-help]');
const docNote = $('[data-doc-note]');
const rules = $('[data-rules]');
const hint = $('[data-hint]');
const frame = $('[data-frame]');
const dropzone = $('[data-dropzone]');
const input = $('[data-file-input]');
const empty = $('[data-empty]');
const editor = $('[data-editor]');
const canvas = $('[data-canvas]');
const zoomInput = $('[data-zoom]');
const zoomOutput = zoomInput.parentElement.querySelector('output');
const checks = $('[data-checks]');
const note = $('[data-output-note]');
const sourceInfo = $('[data-source-info]');
const photoBtn = $('[data-download="photo"]');
const sheetBtn = $('[data-download="sheet"]');

docSelect.innerHTML = Object.entries(DOCS).map(([id, d]) => `<option value="${id}">${d.label}</option>`).join('');
persistForm(form, 'passport-photo-maker');

let decoded = null; // the full-size photo
let preview = null; // a smaller copy for smooth dragging
let view = null; // { zoom, cx, cy } in full-size pixels
let output = null; // { blob, width, height, ext } ready to download
let opening = 0; // newest photo being opened
let preparing = 0; // newest set of files being made

const doc = () => docFor(readForm(form).doc);
const ratio = () => aspect(doc());

// ------------------------------------------------------------ opening a photo
async function open(file) {
  if (!file) return;
  if (!isImage(file.name, file.type)) return toast('That file isn’t a photo.', { error: true });
  const gen = ++opening;
  setBusy(true);
  try {
    const next = await decode(file);
    if (gen !== opening) return next.close();
    decoded?.close();
    decoded = next;
    preview = makePreview(decoded);
    view = initialView(decoded, ratio());
    shape = doc().ratio.join(':');
    zoomInput.max = String(Math.round(maxZoom(decoded, ratio()) * 100));
    sourceInfo.textContent = `${decoded.width} × ${decoded.height} px`;
    empty.hidden = true;
    editor.hidden = false;
    fitCanvas();
    changed();
  } catch (err) {
    toast(err.message || 'This photo couldn’t be opened.', { error: true });
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  root.querySelector('[data-sample]').disabled = busy;
}

/** Dragging redraws many times a second; a copy no larger than 2000 px keeps that smooth on phones. */
function makePreview(d) {
  const scale = Math.min(1, 2000 / Math.max(d.width, d.height));
  if (scale === 1) return { source: d.source, scale: 1 };
  const c = document.createElement('canvas');
  c.width = Math.round(d.width * scale);
  c.height = Math.round(d.height * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(d.source, 0, 0, c.width, c.height);
  return { source: c, scale };
}

input.addEventListener('change', () => {
  open(input.files[0]);
  input.value = '';
});

let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  dropzone.classList.add('is-over');
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropzone.classList.remove('is-over');
});
window.addEventListener('dragover', (e) => {
  if (hasFiles(e)) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove('is-over');
  open(e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  open(file);
});

root.querySelector('[data-sample]').addEventListener('click', async () => open(await sampleFigure()));

// ------------------------------------------------------------ drawing the editor
function fitCanvas() {
  const r = ratio();
  frame.style.aspectRatio = `${doc().ratio[0]} / ${doc().ratio[1]}`;
  frame.style.maxWidth = r < 1 ? '330px' : '420px';
  const width = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
  const height = Math.round(width / r);
  if (width && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
}

function draw() {
  if (!decoded) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const crop = cropRect(decoded, view, ratio());
  const k = preview.scale;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(preview.source, crop.sx * k, crop.sy * k, crop.sw * k, crop.sh * k, 0, 0, W, H);

  const d = doc();
  const g = guides(d);
  const u = W / 400; // sizes below are for a 400 px wide frame
  const line = (y, dash = []) => {
    for (const [color, width] of [['rgba(23,33,43,0.85)', 3.5 * u], ['#ffc83d', 1.75 * u]]) {
      ctx.beginPath();
      ctx.setLineDash(dash.map((v) => v * u));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(0, y * H);
      ctx.lineTo(W, y * H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  const label = (text, y) => {
    ctx.font = `600 ${12 * u}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 12 * u;
    const h = 19 * u;
    const top = y * H + 3 * u;
    ctx.fillStyle = 'rgba(23,33,43,0.85)';
    ctx.fillRect(6 * u, top, w, h);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 12 * u, top + h / 2 + 0.5 * u);
  };

  // band for the top of the head
  ctx.fillStyle = 'rgba(255,200,61,0.28)';
  ctx.fillRect(0, g.hairTop * H, W, (g.hairBottom - g.hairTop) * H);
  line(g.hairTop, [6, 5]);
  line(g.hairBottom, [6, 5]);
  line(g.chin);
  // center line and a face outline to aim for
  ctx.strokeStyle = 'rgba(23,33,43,0.55)';
  ctx.lineWidth = 1 * u;
  ctx.setLineDash([4 * u, 6 * u]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.beginPath();
  const headH = (g.chin - g.crown) * H;
  ctx.ellipse(W / 2, ((g.crown + g.chin) / 2) * H, headH * 0.36, headH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // only label the band when it's tall enough to hold the text
  if ((g.hairBottom - g.hairTop) * H > 24 * u) label(d.topOf === 'hair' ? 'Top of hair in this band' : 'Top of head in this band', g.hairTop);
  label('Chin on this line', g.chin);
}

// ------------------------------------------------------------ moving and zooming
function setView(next) {
  view = next;
  changed();
}

function changed() {
  const crop = cropRect(decoded, view, ratio());
  view = crop;
  zoomInput.value = String(Math.round(crop.zoom * 100));
  zoomOutput.textContent = `${zoomInput.value}%`;
  draw();
  photoBtn.disabled = true;
  sheetBtn.disabled = true;
  prepare();
}

zoomInput.addEventListener('input', () => {
  if (decoded) setView(zoomAt(decoded, view, Number(zoomInput.value) / 100, 0.5, 0.5, ratio()));
});

const pointers = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!decoded) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom };
  }
});
canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev || !decoded) return;
  const rect = canvas.getBoundingClientRect();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    setView(panBy(decoded, view, (e.clientX - prev.x) / rect.width, (e.clientY - prev.y) / rect.height, ratio()));
  } else if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const zoom = pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance);
    setView(zoomAt(decoded, view, zoom, ((a.x + b.x) / 2 - rect.left) / rect.width, ((a.y + b.y) / 2 - rect.top) / rect.height, ratio()));
  }
});
for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  });
}
canvas.addEventListener('keydown', (e) => {
  if (!decoded) return;
  const step = e.shiftKey ? 0.05 : 0.01;
  const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (moves[e.key]) setView(panBy(decoded, view, ...moves[e.key], ratio()));
  else if (e.key === '+' || e.key === '=') setView(zoomAt(decoded, view, view.zoom * 1.03, 0.5, 0.5, ratio()));
  else if (e.key === '-' || e.key === '_') setView(zoomAt(decoded, view, view.zoom / 1.03, 0.5, 0.5, ratio()));
  else return;
  e.preventDefault();
});

window.addEventListener('resize', debounce(() => {
  if (!decoded) return;
  fitCanvas();
  draw();
}, 100));

let shape = '';
function syncDoc() {
  const d = doc();
  docHelp.textContent = d.help;
  docNote.textContent = d.note || '';
  docNote.hidden = !d.note;
  const top = d.topOf === 'hair' ? 'top of your hair' : 'top of your head (not your hair)';
  hint.innerHTML = `Drag the photo and zoom until your <strong>chin rests on the lower line</strong> and the <strong>${top} is inside the shaded band</strong>.`;
  rules.innerHTML = [
    `<strong>${d.background}</strong>, with no shadows, patterns or objects.`,
    `<strong>${d.glasses}</strong>, and no hats or headphones. Head coverings only for religious or medical reasons.`,
    '<strong>Face the camera</strong>, eyes open, neutral expression, mouth closed.',
    '<strong>Even light</strong> on your face, in color, sharp and in focus.',
    `<strong>${d.recent}.</strong>`,
    '<strong>Not edited.</strong> No filters, retouching or AI. If the background or lighting is wrong, take the photo again.',
  ].map((r) => `<li>${r}</li>`).join('');
  sheetBtn.hidden = !d.print;
  photoBtn.textContent = d.file.upload ? 'Download photo' : 'Download single photo';
  if (!decoded) return;
  // a different shape of photo (square or portrait) starts from a fresh view
  const next = d.ratio.join(':');
  if (next !== shape) view = initialView(decoded, ratio());
  shape = next;
  zoomInput.max = String(Math.round(maxZoom(decoded, ratio()) * 100));
  fitCanvas();
  changed();
}
form.addEventListener('change', syncDoc);
form.addEventListener('submit', (e) => e.preventDefault());
syncDoc();

// ------------------------------------------------------------ making the files
/** The cropped photo at this pixel size. Only cropped and resized: no pixels are retouched. */
function renderPhoto(width, height) {
  const crop = cropRect(decoded, view, ratio());
  const plan = { width, height, sx: crop.sx, sy: crop.sy, sw: crop.sw, sh: crop.sh, dx: 0, dy: 0, dw: width, dh: height };
  return render(decoded, plan, { background: '#ffffff' });
}

async function withDpi(blob, dpi) {
  if (blob.type !== 'image/jpeg') return blob;
  return new Blob([setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi)], { type: 'image/jpeg' });
}

/** The top corners of the photo, where only the wall should show. Read from a small copy; the photo isn't touched. */
function cornerPixels(c) {
  const w = Math.round(c.width * 0.08);
  const h = Math.round(c.height * 0.2);
  const inset = Math.round(c.width * 0.02);
  const y = Math.round(c.height * 0.03);
  const scratch = document.createElement('canvas');
  scratch.width = w * 2;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(c, inset, y, w, h, 0, 0, w, h);
  ctx.drawImage(c, c.width - w - inset, y, w, h, w, 0, w, h);
  return [ctx.getImageData(0, 0, w, h).data, ctx.getImageData(w, 0, w, h).data];
}

const prepare = debounce(async () => {
  if (!decoded) return;
  const gen = ++preparing;
  const d = doc();
  const file = d.file;
  const crop = cropRect(decoded, view, ratio());
  const { width, height, enlarged } = outputSize(crop.sw, d);
  try {
    const c = renderPhoto(width, height);
    const background = backgroundCheck(...cornerPixels(c));
    let blob;
    if (file.minBytes) {
      // best quality; step up if the file would be under the form's minimum size
      blob = await encode(c, 'image/jpeg', 0.95);
      if (blob.size < file.minBytes) blob = await encode(c, 'image/jpeg', 1);
      if (blob.size < file.minBytes) blob = await encode(c, 'image/png');
    } else if (file.maxBytes) {
      blob = (await fitToSize((q) => encode(c, 'image/jpeg', q), file.maxBytes, { max: 0.95 })).blob;
    } else {
      blob = await encode(c, 'image/jpeg', 0.95);
    }
    c.width = c.height = 0;
    blob = await withDpi(blob, printDpi(width, d));
    if (gen !== preparing) return;
    output = { blob, width, height, ext: blob.type === 'image/png' ? 'png' : 'jpg' };
    showChecks({ width, height, enlarged, cropWidth: Math.round(crop.sw), background, size: sizeCheck(blob.size, file), bytes: blob.size, file });
    const parts = [`Photo: ${width} × ${height} px ${output.ext.toUpperCase()}, ${formatBytes(blob.size)}${file.upload ? '' : ', for a photo shop rather than an online form'}.`];
    if (d.print) parts.push(`Print sheet: ${d.print.count} photos of ${d.print.label} on a 4 × 6 inch print.`);
    note.textContent = parts.join(' ');
    photoBtn.disabled = false;
    sheetBtn.disabled = false;
  } catch (err) {
    if (gen !== preparing) return;
    note.textContent = '';
    toast(err.message || 'The photo couldn’t be created.', { error: true });
  }
}, 200);

function showChecks({ width, height, enlarged, cropWidth, background, size, bytes, file }) {
  const rows = [
    enlarged
      ? [false, `The area you chose is only ${cropWidth} px wide. Zoom out or use a larger photo, or it will look soft.`]
      : [true, `Sharp enough: ${width} × ${height} px.`],
  ];
  if (file.upload) {
    rows.push(
      size.ok
        ? [true, `File size fits the form: ${formatBytes(bytes)}.`]
        : [false, size.problem === 'small' ? `File is ${formatBytes(bytes)}, under the ${formatBytes(file.minBytes)} minimum. Use a larger, sharper photo.` : `File is ${formatBytes(bytes)}, over the ${formatBytes(file.maxBytes)} limit.`],
    );
  }
  rows.push(
    background.ok
      ? [true, 'Background behind your head looks light and even.']
      : [false, `Background looks ${background.light ? 'uneven: a shadow, pattern or object' : 'dark'}. This tool won’t change it, because edited photos are rejected. Retake the photo against a plain, light wall.`],
  );
  checks.innerHTML = rows
    .map(([ok, text]) => `<li class="${ok ? 'is-pass' : 'is-fail'}"><span class="checks-list__mark">${ok ? 'OK' : 'Check'}</span><span>${text}</span></li>`)
    .join('');
}

photoBtn.addEventListener('click', () => {
  if (!output) return;
  downloadBlob(output.blob, fileName(readForm(form).doc, 'photo', output.ext, output.width, output.height));
});

sheetBtn.addEventListener('click', async () => {
  const d = doc();
  if (!decoded || !d.print) return;
  sheetBtn.disabled = true;
  try {
    const dpi = 300;
    const layout = sheetLayout({ dpi, photo: d.print.inches, count: d.print.count });
    const photo = renderPhoto(layout.w, layout.h);
    const c = document.createElement('canvas');
    c.width = layout.width;
    c.height = layout.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#9aa5af';
    ctx.lineWidth = 2;
    for (const p of layout.photos) {
      ctx.drawImage(photo, p.x, p.y);
      ctx.strokeRect(p.x - 1, p.y - 1, layout.w + 2, layout.h + 2); // cut along the outside of this line
    }
    ctx.fillStyle = '#5d6a77';
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Print on 4 × 6 in photo paper at full size. Each photo should measure ${d.print.label}.`, c.width / 2, layout.photos[0].y + layout.h + 110);
    const blob = await withDpi(await encode(c, 'image/jpeg', 0.95), dpi);
    photo.width = photo.height = 0;
    c.width = c.height = 0;
    downloadBlob(blob, fileName(readForm(form).doc, 'sheet', 'jpg'));
  } catch (err) {
    toast(err.message || 'The print sheet couldn’t be created.', { error: true });
  } finally {
    sheetBtn.disabled = false;
  }
});

// ------------------------------------------------------------ sample
/** A drawn figure (not a real person) so people can try the guides without their own photo. */
async function sampleFigure() {
  const W = 1500;
  const H = 2000;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3f2ee';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3f5873'; // shoulders
  ctx.beginPath();
  ctx.moveTo(150, H);
  ctx.bezierCurveTo(170, 1480, 520, 1420, 750, 1420);
  ctx.bezierCurveTo(980, 1420, 1330, 1480, 1350, H);
  ctx.fill();
  ctx.fillStyle = '#d9a67e'; // neck
  ctx.fillRect(640, 1180, 220, 300);
  ctx.fillStyle = '#4a3527'; // hair
  ctx.beginPath();
  ctx.ellipse(750, 800, 330, 400, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e6b790'; // face
  ctx.beginPath();
  ctx.ellipse(750, 900, 270, 360, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2622'; // eyes
  for (const x of [640, 860]) {
    ctx.beginPath();
    ctx.ellipse(x, 850, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#8b5a44'; // mouth
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(680, 1080);
  ctx.lineTo(820, 1080);
  ctx.stroke();
  const blob = await encode(c, 'image/jpeg', 0.92);
  return new File([blob], 'sample-drawing.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}
