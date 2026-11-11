// Shared page logic for the image tools: add files (choose, drop or paste), process each one
// with the tool's own `process` function, preview, compare, and download one or all as a ZIP.

import { isImage, detectType, formatBytes, sizeChange, uniqueNames } from './image-core.js';
import { decode, sampleImage } from './image-engine.js';
import { createZip } from './zip.js';
import { downloadBlob, toast, debounce } from './ui.js';

const MAX_FILES = 50;

/**
 * config = {
 *   root:        element containing the tool
 *   form:        the options form (changes re-run processing)
 *   readOptions: () => options object
 *   process:     async (item, options) => ({ blob, width, height, name, note? })
 *   zipName:     file name for "Download all"
 *   sample:      options for the sample image ({ type, quality, transparent })
 * }
 */
export function createBatch(config) {
  const { root, form, readOptions, process, zipName = 'images.zip', sample = {}, showChange = true, doneVerb = '' } = config;
  const $ = (sel) => root.querySelector(sel);
  const dropzone = $('[data-dropzone]');
  const input = $('[data-file-input]');
  const list = $('[data-files]');
  const empty = $('[data-empty]');
  const bar = $('[data-bar]');
  const summary = $('[data-summary]');
  const downloadAll = $('[data-download-all]');
  const clearBtn = $('[data-clear]');
  const preview = $('[data-preview]');
  const previewImg = $('[data-preview-img]');
  const previewCaption = $('[data-preview-caption]');
  const compare = $('[data-compare]');

  let items = [];
  let nextId = 1;
  let generation = 0;
  let selected = null;
  let running = false;

  // ------------------------------------------------------------ adding files
  function addFiles(fileList) {
    const files = [...fileList];
    const images = files.filter((f) => isImage(f.name, f.type));
    const skipped = files.length - images.length;
    const room = MAX_FILES - items.length;
    if (images.length > room) toast(`Up to ${MAX_FILES} images at a time — added the first ${Math.max(room, 0)}.`, { error: true });
    else if (skipped) toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that ${skipped > 1 ? 'aren’t images' : 'isn’t an image'}.`, { error: true });
    for (const file of images.slice(0, Math.max(room, 0))) {
      const item = {
        id: nextId++,
        file,
        name: file.name || 'image.png',
        type: detectType(file.name, file.type),
        size: file.size,
        origUrl: URL.createObjectURL(file),
        decoded: null,
        status: 'waiting',
        result: null,
        error: '',
      };
      items.push(item);
      list.append(buildRow(item));
      if (!selected) selected = item.id;
    }
    if (images.length) run();
    refreshChrome();
  }

  input?.addEventListener('change', () => {
    addFiles(input.files);
    input.value = ''; // allow choosing the same file again
  });

  // drag and drop anywhere on the page
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    dropzone?.classList.add('is-over');
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropzone?.classList.remove('is-over');
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropzone?.classList.remove('is-over');
    addFiles(e.dataTransfer.files);
  });

  // paste an image (screenshots, copied pictures)
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    addFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${stamp}${i ? `-${i + 1}` : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))));
  });

  root.querySelectorAll('[data-sample]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        addFiles([await sampleImage(sample)]);
      } finally {
        btn.disabled = false;
      }
    }),
  );

  // ------------------------------------------------------------ processing
  async function run() {
    const gen = ++generation;
    running = true;
    refreshChrome();
    const options = readOptions();
    for (const item of [...items]) {
      if (gen !== generation) return;
      if (!items.includes(item)) continue;
      if (item.status === 'broken') continue;
      if (!item.decoded) {
        item.status = 'opening';
        updateRow(item);
        try {
          item.decoded = await decode(item.file);
          item.width = item.decoded.width;
          item.height = item.decoded.height;
        } catch (err) {
          item.status = 'broken';
          item.error = err.message;
          updateRow(item);
          continue;
        }
      }
      item.status = 'working';
      updateRow(item);
      try {
        const out = await process(item, options);
        if (gen !== generation || !items.includes(item)) return;
        const oldUrl = item.result?.url;
        item.result = { ...out, size: out.blob.size, url: URL.createObjectURL(out.blob) };
        item.status = 'done';
        item.error = '';
        updateRow(item);
        if (item.id === selected) showPreview();
        if (oldUrl) URL.revokeObjectURL(oldUrl); // only after the preview has moved to the new one
      } catch (err) {
        if (gen !== generation) return;
        item.status = 'error';
        item.error = err.message || 'Something went wrong with this image.';
        updateRow(item);
        if (item.id === selected) showPreview();
      }
      refreshChrome();
    }
    if (gen === generation) {
      running = false;
      refreshChrome();
      showPreview();
    }
  }

  const rerun = debounce(() => {
    if (items.length) run();
  }, 250);
  const onOptionsChanged = (e) => {
    if (e.target !== input) rerun(); // the file picker isn't an option
  };
  form?.addEventListener('input', onOptionsChanged);
  form?.addEventListener('change', onOptionsChanged);

  // ------------------------------------------------------------ list rows
  function buildRow(item) {
    const li = document.createElement('li');
    li.className = 'file';
    li.dataset.id = item.id;
    li.innerHTML = `
      <button type="button" class="file__select" aria-label="Preview">
        <img class="file__thumb" alt="" loading="lazy" decoding="async">
        <span class="file__text">
          <span class="file__name"></span>
          <span class="file__meta"></span>
          <span class="file__note"></span>
        </span>
      </button>
      <span class="file__actions">
        <button type="button" class="button button--small" data-action="download" disabled>Download</button>
        <button type="button" class="icon-button" data-action="remove" aria-label="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </span>`;
    const thumb = li.querySelector('.file__thumb');
    thumb.src = item.origUrl;
    thumb.addEventListener('error', () => thumb.classList.add('file__thumb--none'), { once: true });
    li.querySelector('.file__name').textContent = item.name;
    li.querySelector('.file__select').setAttribute('aria-label', `Preview ${item.name}`);
    li.querySelector('.file__select').addEventListener('click', () => {
      selected = item.id;
      showPreview();
      preview?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    li.querySelector('[data-action="download"]').addEventListener('click', () => {
      if (item.result) downloadBlob(item.result.blob, item.result.name);
    });
    li.querySelector('[data-action="remove"]').addEventListener('click', () => remove(item));
    item.row = li;
    updateRow(item);
    return li;
  }

  function updateRow(item) {
    const li = item.row;
    if (!li) return;
    const meta = li.querySelector('.file__meta');
    const note = li.querySelector('.file__note');
    const dl = li.querySelector('[data-action="download"]');
    li.classList.toggle('is-selected', item.id === selected);
    li.classList.toggle('is-error', item.status === 'error' || item.status === 'broken');
    note.className = 'file__note';
    dl.disabled = item.status !== 'done';

    const dims = item.width ? `${item.width} × ${item.height}` : '';
    if (item.status === 'done') {
      const r = item.result;
      const change = sizeChange(item.size, r.size);
      const sizes = `${formatBytes(item.size)} → ${formatBytes(r.size)}`;
      const dimText = dims && (r.width !== item.width || r.height !== item.height) ? `${dims} → ${r.width} × ${r.height}` : `${r.width} × ${r.height}`;
      meta.textContent = `${dimText}, ${sizes}`;
      if (!showChange) {
        note.textContent = r.note || '';
      } else if (change < 0) {
        note.textContent = `${-change}% smaller${r.note ? `. ${r.note}` : ''}`;
        note.classList.add('file__note--good');
      } else if (change > 0) {
        note.textContent = `${change}% larger${r.note ? `. ${r.note}` : ''}`;
      } else {
        note.textContent = r.note || 'Same size';
      }
    } else if (item.status === 'error' || item.status === 'broken') {
      meta.textContent = [dims, formatBytes(item.size)].filter(Boolean).join(', ');
      note.textContent = item.error;
      note.classList.add('file__note--error');
    } else {
      meta.textContent = [dims, formatBytes(item.size)].filter(Boolean).join(', ');
      note.textContent = item.status === 'opening' ? 'Opening…' : item.status === 'working' ? 'Working…' : 'Waiting…';
    }
  }

  function dispose(item) {
    item.decoded?.close?.();
    URL.revokeObjectURL(item.origUrl);
    if (item.result?.url) URL.revokeObjectURL(item.result.url);
    item.row?.remove();
  }

  function remove(item) {
    if (selected === item.id) previewImg?.removeAttribute('src');
    dispose(item);
    items = items.filter((i) => i !== item);
    if (selected === item.id) selected = items[0]?.id ?? null;
    showPreview();
    refreshChrome();
  }

  clearBtn?.addEventListener('click', () => {
    generation++; // stop any processing in progress
    previewImg?.removeAttribute('src');
    items.forEach(dispose);
    items = [];
    selected = null;
    running = false;
    showPreview();
    refreshChrome();
  });

  // ------------------------------------------------------------ preview and compare
  function showPreview() {
    items.forEach(updateRow);
    const item = items.find((i) => i.id === selected);
    if (!preview) return;
    if (!item) {
      preview.hidden = true;
      return;
    }
    preview.hidden = false;
    const ready = item.status === 'done';
    previewImg.src = ready ? item.result.url : item.origUrl;
    previewImg.alt = `Preview of ${item.name}`;
    if (compare) compare.disabled = !ready;
    previewCaption.textContent = ready
      ? `${item.result.name}: ${item.result.width} × ${item.result.height}, ${formatBytes(item.result.size)}`
      : item.status === 'error' || item.status === 'broken'
        ? item.error
        : `${item.name}: working…`;
  }

  if (compare) {
    const showOriginal = () => {
      const item = items.find((i) => i.id === selected);
      if (item?.status === 'done') {
        previewImg.src = item.origUrl;
        compare.setAttribute('aria-pressed', 'true');
      }
    };
    const showResult = () => {
      const item = items.find((i) => i.id === selected);
      if (item?.status === 'done') previewImg.src = item.result.url;
      compare.setAttribute('aria-pressed', 'false');
    };
    compare.addEventListener('pointerdown', showOriginal);
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => compare.addEventListener(ev, showResult));
    compare.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        showOriginal();
      }
    });
    compare.addEventListener('keyup', showResult);
  }

  // ------------------------------------------------------------ summary and download all
  function refreshChrome() {
    const hasItems = items.length > 0;
    if (empty) empty.hidden = hasItems;
    list.hidden = !hasItems;
    if (bar) bar.hidden = !hasItems;
    if (clearBtn) clearBtn.hidden = !hasItems;
    const done = items.filter((i) => i.status === 'done');
    const pending = items.filter((i) => ['waiting', 'opening', 'working'].includes(i.status)).length;
    if (downloadAll) {
      downloadAll.disabled = done.length === 0 || (running && pending > 0);
      downloadAll.textContent = done.length > 1 ? `Download all (${done.length}) as ZIP` : 'Download';
    }
    if (!summary) return;
    if (running && pending) {
      summary.textContent = `Working on ${items.length - pending + 1} of ${items.length}…`;
      return;
    }
    if (!done.length) {
      summary.textContent = items.length ? 'None of these images could be processed.' : '';
      return;
    }
    const before = done.reduce((n, i) => n + i.size, 0);
    const after = done.reduce((n, i) => n + i.result.size, 0);
    const change = sizeChange(before, after);
    const changeText = change < 0 ? `${-change}% smaller` : change > 0 ? `${change}% larger` : 'same size';
    const count = `${done.length} image${done.length > 1 ? 's' : ''}${doneVerb ? ` ${doneVerb}` : ''}`;
    summary.textContent = showChange
      ? `${count}: ${formatBytes(before)} → ${formatBytes(after)}, ${changeText}`
      : `${count}: ${formatBytes(before)} → ${formatBytes(after)}`;
  }

  downloadAll?.addEventListener('click', async () => {
    const done = items.filter((i) => i.status === 'done');
    if (!done.length) return;
    if (done.length === 1) {
      downloadBlob(done[0].result.blob, done[0].result.name);
      return;
    }
    downloadAll.disabled = true;
    try {
      const names = uniqueNames(done.map((i) => i.result.name));
      const entries = await Promise.all(
        done.map(async (i, n) => ({ name: names[n], data: new Uint8Array(await i.result.blob.arrayBuffer()), date: new Date() })),
      );
      downloadBlob(new Blob([createZip(entries)], { type: 'application/zip' }), zipName);
      toast(`Downloading ${done.length} images as ${zipName}`);
    } finally {
      downloadAll.disabled = false;
    }
  });

  refreshChrome();
  return { rerun: () => items.length && run(), get items() { return items; } };
}
