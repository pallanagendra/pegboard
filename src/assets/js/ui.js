// Shared helpers for every tool. Pure functions and small DOM utilities — importing this has no side effects.

let toastTimer;

/** Show a short status message at the bottom of the screen. */
export function toast(message, { error = false } = {}) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('toast--error', error);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/** Copy text to the clipboard, with a fallback for older browsers and non-secure origins. */
export async function copyText(text, label = 'Copied') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(label);
    return true;
  } catch {
    toast('Copy failed — select the text and copy it manually.', { error: true });
    return false;
  }
}

/** Save a Blob as a file. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save an SVG element as an .svg file. */
export function downloadSvg(svgEl, filename) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  downloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Render an SVG element to a PNG at the given scale and download it. */
export async function downloadSvgAsPng(svgEl, filename, scale = 4) {
  const blob = await svgToPngBlob(svgEl, scale);
  downloadBlob(blob, filename);
}

export function svgToPngBlob(svgEl, scale = 4) {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const vb = svgEl.viewBox?.baseVal;
    const w = Number(svgEl.getAttribute('width')) || vb?.width || svgEl.getBoundingClientRect().width;
    const h = Number(svgEl.getAttribute('height')) || vb?.height || svgEl.getBoundingClientRect().height;
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not render the image'));
    img.src = src;
  });
}

/** Run fn at most once per `ms` of quiet. */
export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Read every named control in a form into a plain object (checkboxes → booleans). */
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.type === 'number' || el.type === 'range') out[el.name] = el.value === '' ? '' : Number(el.value);
    else out[el.name] = el.value;
  }
  return out;
}

/** Keep the little <output> next to each range slider in sync. */
export function bindRangeOutputs(root = document) {
  root.querySelectorAll('.range').forEach((wrap) => {
    const input = wrap.querySelector('input[type="range"]');
    const output = wrap.querySelector('output');
    if (!input || !output) return;
    const suffix = output.dataset.suffix || '';
    const sync = () => { output.textContent = input.value + suffix; };
    input.addEventListener('input', sync);
    sync();
  });
}

/** Mirror a color picker and a hex text field. */
export function bindColorPairs(root = document) {
  root.querySelectorAll('.color-field').forEach((wrap) => {
    const picker = wrap.querySelector('input[type="color"]');
    const text = wrap.querySelector('input[type="text"]');
    if (!picker || !text) return;
    picker.addEventListener('input', () => { text.value = picker.value; text.dispatchEvent(new Event('input', { bubbles: true })); });
    const syncPicker = () => {
      const v = text.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v) && picker.value.toLowerCase() !== v.toLowerCase()) picker.value = v;
    };
    text.addEventListener('input', syncPicker);
    text.addEventListener('change', syncPicker);
    syncPicker();
  });
}

/** Save and restore a form's values in this browser only (sessionStorage). */
export function persistForm(form, key) {
  const storageKey = `tool:${key}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved) {
      for (const el of form.elements) {
        if (!el.name || !(el.name in saved)) continue;
        if (el.type === 'checkbox') el.checked = !!saved[el.name];
        else if (el.type === 'radio') el.checked = saved[el.name] === el.value;
        else el.value = saved[el.name];
        // let helpers (range labels, color swatches) catch up with the restored value
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  } catch { /* storage unavailable */ }
  const saveNow = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(readForm(form))); } catch { /* ignore */ }
  };
  const save = debounce(saveNow, 150);
  form.addEventListener('input', save);
  form.addEventListener('change', save);
  window.addEventListener('pagehide', saveNow); // don't lose the last keystrokes on reload or navigation
}

/** A filename-safe slug from free text. */
export function fileSlug(text, fallback = 'download') {
  const s = String(text || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || fallback;
}
