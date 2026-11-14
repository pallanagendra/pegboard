import { decode, render, encode } from '../../assets/js/image-engine.js';
import { isImage, formatBytes, fitToSize } from '../../assets/js/image-core.js';
import { readForm, persistForm, downloadBlob, toast, debounce } from '../../assets/js/ui.js';
import { DOCS, docFor, guides, cropSquare, initialView, panBy, zoomAt, maxZoom, outputSide, sheetLayout, setJpegDpi, sizeCheck, backgroundCheck, fileName } from './logic.js';

const root = document.querySelector('[data-tool]');
const $ = (sel) => root.querySelector(sel);
const form = $('[data-form]');
const docSelect = $('[data-docs]');
const docHelp = $('[data-doc-help]');
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
let output = null; // { blob, side, ext } ready to download
let opening = 0; // newest photo being opened
let preparing = 0; // newest set of files being made

const doc = () => docFor(readForm(form).doc);

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
    view = initialView(decoded);
    zoomInput.max = String(Math.round(maxZoom(decoded) * 100));
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
  const side = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
  if (side && canvas.width !== side) {
    canvas.width = side;
    canvas.height = side;
  }
}

function draw() {
  if (!decoded) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const crop = cropSquare(decoded, view);
  const k = preview.scale;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(preview.source, crop.sx * k, crop.sy * k, crop.size * k, crop.size * k, 0, 0, S, S);

  const g = guides(doc());
  const u = S / 400; // sizes below are for a 400 px frame
  const line = (y, dash = []) => {
    for (const [color, width] of [['rgba(23,33,43,0.85)', 3.5 * u], ['#ffc83d', 1.75 * u]]) {
      ctx.beginPath();
      ctx.setLineDash(dash.map((d) => d * u));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(0, y * S);
      ctx.lineTo(S, y * S);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  const label = (text, y, above) => {
    ctx.font = `600 ${11 * u}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 12 * u;
    const h = 18 * u;
    const top = above ? y * S - h - 3 * u : y * S + 3 * u;
    ctx.fillStyle = 'rgba(23,33,43,0.85)';
    ctx.fillRect(6 * u, top, w, h);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 12 * u, top + h / 2 + 0.5 * u);
  };

  // band for the top of the hair
  ctx.fillStyle = 'rgba(255,200,61,0.28)';
  ctx.fillRect(0, g.hairTop * S, S, (g.hairBottom - g.hairTop) * S);
  line(g.hairTop, [6, 5]);
  line(g.hairBottom, [6, 5]);
  line(g.chin);
  // center line and a face outline to aim for
  ctx.strokeStyle = 'rgba(23,33,43,0.55)';
  ctx.lineWidth = 1 * u;
  ctx.setLineDash([4 * u, 6 * u]);
  ctx.beginPath();
  ctx.moveTo(S / 2, 0);
  ctx.lineTo(S / 2, S);
  ctx.stroke();
  ctx.beginPath();
  const headH = g.chin - g.crown;
  ctx.ellipse(S / 2, ((g.crown + g.chin) / 2) * S, headH * 0.36 * S, (headH / 2) * S, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  label('Top of hair in this band', g.hairTop, false);
  label('Chin on this line', g.chin, false);
}

// ------------------------------------------------------------ moving and zooming
function setView(next) {
  view = next;
  changed();
}

function changed() {
  const crop = cropSquare(decoded, view);
  view = crop;
  zoomInput.value = String(Math.round(crop.zoom * 100));
  zoomOutput.textContent = `${zoomInput.value}%`;
  draw();
  photoBtn.disabled = true;
  sheetBtn.disabled = true;
  prepare();
}

zoomInput.addEventListener('input', () => {
  if (decoded) setView(zoomAt(decoded, view, Number(zoomInput.value) / 100));
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
    setView(panBy(decoded, view, (e.clientX - prev.x) / rect.width, (e.clientY - prev.y) / rect.height));
  } else if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const zoom = pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance);
    setView(zoomAt(decoded, view, zoom, ((a.x + b.x) / 2 - rect.left) / rect.width, ((a.y + b.y) / 2 - rect.top) / rect.height));
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
  if (moves[e.key]) setView(panBy(decoded, view, ...moves[e.key]));
  else if (e.key === '+' || e.key === '=') setView(zoomAt(decoded, view, view.zoom * 1.03));
  else if (e.key === '-' || e.key === '_') setView(zoomAt(decoded, view, view.zoom / 1.03));
  else return;
  e.preventDefault();
});

window.addEventListener('resize', debounce(() => {
  if (!decoded) return;
  fitCanvas();
  draw();
}, 100));

function syncDoc() {
  docHelp.textContent = doc().help;
  if (decoded) changed();
}
form.addEventListener('change', syncDoc);
form.addEventListener('submit', (e) => e.preventDefault());
syncDoc();

// ------------------------------------------------------------ making the files
/** The cropped photo at `side` pixels. Only cropped and resized: no pixels are retouched. */
function renderPhoto(side) {
  const crop = cropSquare(decoded, view);
  const plan = { width: side, height: side, sx: crop.sx, sy: crop.sy, sw: crop.size, sh: crop.size, dx: 0, dy: 0, dw: side, dh: side };
  return render(decoded, plan, { background: '#ffffff' });
}

async function withDpi(blob, dpi) {
  if (blob.type !== 'image/jpeg') return blob;
  return new Blob([setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi)], { type: 'image/jpeg' });
}

/** The top corners of the photo, where only the wall should show. Read from a small copy; the photo isn't touched. */
function cornerPixels(c) {
  const w = Math.round(c.width * 0.1);
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
  const digital = d.digital;
  const crop = cropSquare(decoded, view);
  const { side, enlarged } = outputSide(crop.size, digital);
  try {
    const c = renderPhoto(side);
    const background = backgroundCheck(...cornerPixels(c));
    let blob;
    if (digital.minBytes) {
      // passport upload: best quality; step up if the file would be under the form's minimum size
      blob = await encode(c, 'image/jpeg', 0.95);
      if (blob.size < digital.minBytes) blob = await encode(c, 'image/jpeg', 1);
      if (blob.size < digital.minBytes) blob = await encode(c, 'image/png');
    } else {
      blob = (await fitToSize((q) => encode(c, 'image/jpeg', q), digital.maxBytes, { max: 0.95 })).blob;
    }
    c.width = c.height = 0;
    blob = await withDpi(blob, side / d.inches);
    if (gen !== preparing) return;
    output = { blob, side, ext: blob.type === 'image/png' ? 'png' : 'jpg' };
    showChecks({ side, enlarged, cropSize: Math.round(crop.size), background, size: sizeCheck(blob.size, digital), bytes: blob.size, digital });
    note.textContent = `Photo: ${side} × ${side} px ${output.ext.toUpperCase()}, ${formatBytes(blob.size)}. Print sheet: two ${d.inches} × ${d.inches} inch photos on a 4 × 6 inch print.`;
    photoBtn.disabled = false;
    sheetBtn.disabled = false;
  } catch (err) {
    if (gen !== preparing) return;
    note.textContent = '';
    toast(err.message || 'The photo couldn’t be created.', { error: true });
  }
}, 200);

function showChecks({ side, enlarged, cropSize, background, size, bytes, digital }) {
  const rows = [
    enlarged
      ? [false, `The area you chose is only ${cropSize} px across. Zoom out or use a larger photo, or it will look soft.`]
      : [true, `Sharp enough: ${side} × ${side} px.`],
    size.ok
      ? [true, `File size fits the form: ${formatBytes(bytes)}.`]
      : [false, size.problem === 'small' ? `File is ${formatBytes(bytes)}, under the ${formatBytes(digital.minBytes)} minimum. Use a larger, sharper photo.` : `File is ${formatBytes(bytes)}, over the ${formatBytes(digital.maxBytes)} limit.`],
    background.ok
      ? [true, 'Background behind your head looks light and even.']
      : [false, `Background looks ${background.light ? 'uneven: a shadow, pattern or object' : 'dark'}. This tool won’t change it, because edited photos are rejected. Retake the photo against a plain white wall.`],
  ];
  checks.innerHTML = rows
    .map(([ok, text]) => `<li class="${ok ? 'is-pass' : 'is-fail'}"><span class="checks-list__mark">${ok ? 'OK' : 'Check'}</span><span>${text}</span></li>`)
    .join('');
}

photoBtn.addEventListener('click', () => {
  if (!output) return;
  downloadBlob(output.blob, fileName(readForm(form).doc, 'photo', output.ext, output.side));
});

sheetBtn.addEventListener('click', async () => {
  if (!decoded) return;
  sheetBtn.disabled = true;
  try {
    const d = doc();
    const dpi = 300;
    const layout = sheetLayout({ dpi, inches: d.inches, count: 2 });
    const photo = renderPhoto(layout.side);
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
      ctx.strokeRect(p.x - 1, p.y - 1, layout.side + 2, layout.side + 2); // cut along the outside of this line
    }
    ctx.fillStyle = '#5d6a77';
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Print on 4 × 6 in photo paper at full size. Each photo should measure ${d.inches} × ${d.inches} in.`, c.width / 2, layout.photos[0].y + layout.side + 110);
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
