import { parsePages, describeSelection, pdfName, placeImage, move, sortByName } from './logic.js';
import { decode, render, encode } from '../../assets/js/image-engine.js';
import { planResize, formatBytes, isImage } from '../../assets/js/image-core.js';
import { readForm, persistForm, toast, downloadBlob } from '../../assets/js/ui.js';

const root = document.querySelector('[data-tool]');
const $ = (sel) => root.querySelector(sel);
const form = $('[data-form]');
const list = $('[data-list]');
const empty = $('[data-empty]');
const listActions = $('[data-list-actions]');
const totalEl = $('[data-total]');
const mergeBtn = $('[data-merge]');
const status = $('[data-status]');
const againBtn = $('[data-again]');
const dropzone = $('[data-dropzone]');
const input = $('[data-file-input]');
const PDFLib = window.PDFLib;
const MAX_IMAGE_SIDE = 4000; // plenty for print; keeps the PDF a sensible size

let items = [];
let nextId = 1;
let busy = false;
let lastResult = null;

persistForm(form, 'merge-pdf');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
const tick = () => new Promise((r) => setTimeout(r, 0));

function setStatus(text, kind = 'note') {
  status.hidden = !text;
  status.className = `message message--${kind} mt-0`;
  status.textContent = text || '';
}

// ------------------------------------------------------------------ adding files
async function addPdf(file) {
  const item = { id: nextId++, kind: 'pdf', file, name: file.name || 'document.pdf', size: file.size, pages: 0, range: '', state: 'reading' };
  items.push(item);
  draw();
  try {
    item.bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFLib.PDFDocument.load(item.bytes, { updateMetadata: false });
    item.pages = doc.getPageCount();
    item.state = item.pages ? 'ready' : 'error';
    if (!item.pages) item.error = 'This PDF has no pages.';
  } catch (err) {
    item.state = 'error';
    item.error = /encrypt/i.test(err?.message || '')
      ? 'This PDF is password-protected. Open it, print it to a new PDF (or remove the password), then add that copy.'
      : 'This file couldn’t be read as a PDF. It may be damaged or not really a PDF.';
  }
}

async function addImage(file) {
  const item = { id: nextId++, kind: 'image', file, name: file.name || 'photo.jpg', size: file.size, pages: 1, state: 'reading' };
  items.push(item);
  draw();
  let decoded;
  try {
    decoded = await decode(file);
    const plan = planResize(decoded, { mode: 'fit', width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, noEnlarge: true });
    // PNG keeps transparency and sharp text from screenshots; everything else is stored as a JPG
    item.png = /png|webp|gif|svg/.test(file.type) || /\.(png|webp|gif|svg)$/i.test(file.name);
    const canvas = render(decoded, plan, { background: item.png ? null : '#ffffff' });
    const blob = await encode(canvas, item.png ? 'image/png' : 'image/jpeg', 0.9);
    item.bytes = new Uint8Array(await blob.arrayBuffer());
    item.width = plan.width;
    item.height = plan.height;
    item.thumb = URL.createObjectURL(decoded.preview || blob);
    canvas.width = canvas.height = 0;
    item.state = 'ready';
  } catch (err) {
    item.state = 'error';
    item.error = err?.message || 'This image couldn’t be opened.';
  } finally {
    decoded?.close?.();
  }
}

async function addFiles(fileList) {
  if (!PDFLib) {
    setStatus('The PDF tools didn’t load. Refresh the page and try again.', 'error');
    return;
  }
  const files = [...fileList];
  const usable = files.filter((f) => isPdf(f) || isImage(f.name, f.type));
  if (usable.length < files.length) toast(`Skipped ${files.length - usable.length} file${files.length - usable.length > 1 ? 's' : ''} that ${files.length - usable.length > 1 ? 'aren’t PDFs or images' : 'isn’t a PDF or an image'}.`, { error: true });
  lastResult = null;
  againBtn.hidden = true;
  setStatus('');
  for (const f of usable) {
    await (isPdf(f) ? addPdf(f) : addImage(f));
    draw();
  }
}

input.addEventListener('change', () => {
  addFiles(input.files);
  input.value = '';
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-over');
  addFiles(e.dataTransfer.files);
});

// ------------------------------------------------------------------ the list
const DOC_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function metaFor(item) {
  if (item.state === 'reading') return 'Reading…';
  if (item.state === 'error') return formatBytes(item.size);
  if (item.kind === 'image') return `Photo, ${item.width} × ${item.height} · ${formatBytes(item.size)}`;
  return `${describeSelection(item.range, item.pages)} · ${formatBytes(item.size)}`;
}

function draw() {
  list.innerHTML = items
    .map((item, i) => {
      const name = esc(item.name);
      const icon = item.thumb ? `<img src="${item.thumb}" alt="">` : DOC_ICON;
      const pages = item.kind === 'pdf' && item.state === 'ready' && item.pages > 1
        ? `<span class="pdf-row__pages"><label class="visually-hidden" for="mp-range-${item.id}">Pages to use from ${name}</label><input class="input input--small" id="mp-range-${item.id}" value="${esc(item.range)}" placeholder="All pages" autocomplete="off" spellcheck="false" data-range></span>`
        : '';
      return `<li class="pdf-row${item.state === 'error' ? ' is-broken' : ''}" data-id="${item.id}">
        <span class="pdf-row__num">${i + 1}</span>
        <span class="pdf-row__icon">${icon}</span>
        <span class="pdf-row__text"><span class="pdf-row__name" title="${name}">${name}</span><span class="pdf-row__meta" data-meta>${esc(metaFor(item))}</span>${item.error ? `<span class="pdf-row__error">${esc(item.error)}</span>` : ''}</span>
        ${pages}
        <span class="pdf-row__actions">
          <button type="button" class="icon-button" data-move="-1" aria-label="Move ${name} up"${i === 0 ? ' disabled' : ''}>${UP}</button>
          <button type="button" class="icon-button" data-move="1" aria-label="Move ${name} down"${i === items.length - 1 ? ' disabled' : ''}>${DOWN}</button>
          <button type="button" class="icon-button" data-remove aria-label="Remove ${name}">${CROSS}</button>
        </span>
      </li>`;
    })
    .join('');
  empty.hidden = items.length > 0;
  listActions.hidden = items.length < 2;
  totals();
}

function totals() {
  const ready = items.filter((i) => i.state === 'ready');
  let pages = 0;
  let bad = null;
  for (const item of ready) {
    if (item.kind === 'image') { pages += 1; continue; }
    const r = parsePages(item.range, item.pages);
    if (r.error) bad ||= `${item.name}: ${r.error}`;
    else pages += r.pages.length;
  }
  const reading = items.some((i) => i.state === 'reading');
  $('[data-image-size]').hidden = !ready.some((i) => i.kind === 'image');
  if (!items.length) totalEl.textContent = 'Add files to begin.';
  else totalEl.textContent = `${ready.length} file${ready.length === 1 ? '' : 's'}, ${pages} page${pages === 1 ? '' : 's'} in all${reading ? ' (still reading…)' : ''}`;
  mergeBtn.disabled = busy || reading || !ready.length || !!bad;
  mergeBtn.textContent = ready.length === 1 ? 'Save as a new PDF' : 'Merge and download';
  if (bad && !busy) setStatus(bad, 'error');
  else if (status.classList.contains('message--error') && !busy && !lastResult) setStatus('');
}

list.addEventListener('click', (e) => {
  const row = e.target.closest('[data-id]');
  if (!row || busy) return;
  const index = items.findIndex((i) => i.id === Number(row.dataset.id));
  const item = items[index];
  const mv = e.target.closest('[data-move]');
  if (mv) {
    items = move(items, index, Number(mv.dataset.move));
    draw();
    // keep keyboard focus on the row that moved
    const moved = list.querySelector(`[data-id="${item.id}"]`);
    (moved.querySelector(`[data-move="${mv.dataset.move}"]:not([disabled])`) || moved.querySelector('[data-move]:not([disabled])') || moved.querySelector('[data-remove]'))?.focus();
  } else if (e.target.closest('[data-remove]')) {
    if (item.thumb) URL.revokeObjectURL(item.thumb);
    items.splice(index, 1);
    draw();
  }
});

list.addEventListener('input', (e) => {
  if (!e.target.matches('[data-range]')) return;
  const row = e.target.closest('[data-id]');
  const item = items.find((i) => i.id === Number(row.dataset.id));
  item.range = e.target.value;
  const r = parsePages(item.range, item.pages);
  e.target.toggleAttribute('aria-invalid', !!r.error);
  row.querySelector('[data-meta]').textContent = metaFor(item);
  lastResult = null;
  againBtn.hidden = true;
  totals();
});

$('[data-sort]').addEventListener('click', () => { items = sortByName(items); draw(); });
$('[data-reverse]').addEventListener('click', () => { items = items.slice().reverse(); draw(); });
$('[data-clear]').addEventListener('click', () => {
  items.forEach((i) => i.thumb && URL.revokeObjectURL(i.thumb));
  items = [];
  lastResult = null;
  againBtn.hidden = true;
  setStatus('');
  draw();
});

// ------------------------------------------------------------------ merging
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const ready = items.filter((i) => i.state === 'ready');
  if (!ready.length) return;
  const o = readForm(form);
  busy = true;
  totals();
  againBtn.hidden = true;
  try {
    const { PDFDocument } = PDFLib;
    const out = await PDFDocument.create();
    for (const [n, item] of ready.entries()) {
      setStatus(`Adding ${n + 1} of ${ready.length}: ${item.name}…`);
      await tick();
      if (item.kind === 'pdf') {
        const src = await PDFDocument.load(item.bytes, { updateMetadata: false });
        const { pages } = parsePages(item.range, item.pages);
        const copied = await out.copyPages(src, pages);
        copied.forEach((p) => out.addPage(p));
      } else {
        const img = item.png ? await out.embedPng(item.bytes) : await out.embedJpg(item.bytes);
        const at = placeImage(item.width, item.height, o.imageSize);
        const page = out.addPage([at.pageWidth, at.pageHeight]);
        page.drawImage(img, { x: at.x, y: at.y, width: at.width, height: at.height });
      }
    }
    const name = pdfName(o.filename);
    out.setTitle(name.replace(/\.pdf$/i, ''));
    out.setCreator('Pegboard Merge PDF');
    out.setProducer('Pegboard (pdf-lib)');
    setStatus('Saving…');
    await tick();
    const blob = new Blob([await out.save()], { type: 'application/pdf' });
    lastResult = { blob, name };
    downloadBlob(blob, name);
    setStatus(`Done: ${name}, ${out.getPageCount()} pages, ${formatBytes(blob.size)}. Check your downloads.`, 'ok');
    againBtn.hidden = false;
  } catch (err) {
    setStatus(`The merge didn’t work: ${err?.message || 'unknown error'}. Try removing the last file you added.`, 'error');
  } finally {
    busy = false;
    totals();
  }
});

againBtn.addEventListener('click', () => {
  if (lastResult) downloadBlob(lastResult.blob, lastResult.name);
});

// ------------------------------------------------------------------ samples
async function samplePdf(name, title, pages, band, ink) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 682, width: 612, height: 110, color: rgb(...band) });
    page.drawText(title, { x: 54, y: 726, size: 30, font: bold, color: rgb(...ink) });
    page.drawText(`Page ${i} of ${pages}`, { x: 54, y: 620, size: 22, font: body, color: rgb(0.09, 0.13, 0.17) });
    page.drawText('A sample made in your browser to try the merge tool.', { x: 54, y: 586, size: 13, font: body, color: rgb(0.29, 0.35, 0.4) });
  }
  return new File([await doc.save()], name, { type: 'application/pdf' });
}
$('[data-sample]').addEventListener('click', async (e) => {
  if (!PDFLib) return;
  const btn = e.currentTarget;
  btn.disabled = true;
  await addFiles([
    await samplePdf('sample-invoice.pdf', 'Sample invoice', 2, [1, 0.78, 0.24], [0.14, 0.11, 0]),
    await samplePdf('sample-report.pdf', 'Sample report', 3, [0.12, 0.31, 0.82], [1, 1, 1]),
  ]);
  btn.disabled = false;
});

draw();
