import { encodeText, parseBase64, bytesToText, bytesToBase64, sniff, encodedLength } from './logic.js';
import { readForm, persistForm, copyText, downloadBlob } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const $ = (sel) => form.querySelector(sel);
const input = form.text;
const out = $('[data-out]');
const errorEl = $('[data-error]');
const binary = $('[data-binary]');
const binaryText = $('[data-binary-text]');
const binaryImg = $('[data-binary-img]');
const sizes = $('[data-sizes]');
const MAX_FILE = 15 * 1048576;

let decodedFile = null; // { bytes, kind } when the decoded data isn't text
let imgUrl = null;
let file = null; // { name, type, size, b64 }

persistForm(form, 'base64');

const size = (n) => (n < 1024 ? `${n.toLocaleString()} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

function clearBinary() {
  decodedFile = null;
  binary.hidden = true;
  binaryImg.hidden = true;
  if (imgUrl) URL.revokeObjectURL(imgUrl);
  imgUrl = null;
}

function render() {
  draw();
  $('[data-copy]').disabled = !out.value;
  $('[data-swap]').disabled = !out.value;
}

function draw() {
  const o = readForm(form);
  const decode = o.mode === 'decode';
  $('[data-in-label]').textContent = decode ? 'Base64 to decode' : 'Text to encode';
  $('[data-out-label]').textContent = decode ? 'Decoded text' : 'Base64';
  $('[data-encode-options]').hidden = decode;
  errorEl.hidden = true;
  out.hidden = false;
  clearBinary();

  if (!decode) {
    out.value = encodeText(o.text, { urlSafe: o.urlSafe, wrap: o.wrap ? 76 : 0 });
    const bytes = new TextEncoder().encode(o.text || '').length;
    sizes.textContent = bytes ? `${size(bytes)} of text becomes ${out.value.replace(/\n/g, '').length.toLocaleString()} Base64 characters, about a third bigger.` : '';
    return;
  }

  if (!(o.text || '').trim()) {
    out.value = '';
    sizes.textContent = '';
    return;
  }
  const r = parseBase64(o.text);
  if (r.error) {
    out.value = '';
    errorEl.textContent = r.error;
    errorEl.hidden = false;
    sizes.textContent = '';
    return;
  }
  const t = r.mime && !/^text\/|json|xml|svg/.test(r.mime) ? { binary: true } : bytesToText(r.bytes);
  if (t.binary) {
    const kind = sniff(r.bytes, r.mime);
    decodedFile = { bytes: r.bytes, kind };
    out.hidden = true;
    out.value = '';
    binaryText.innerHTML = `This decodes to <strong>${size(r.bytes.length)}</strong> of ${kind.label}, not text.`;
    if (kind.type.startsWith('image/')) {
      imgUrl = URL.createObjectURL(new Blob([r.bytes], { type: kind.type }));
      binaryImg.src = imgUrl;
      binaryImg.alt = `Decoded ${kind.label}`;
      binaryImg.hidden = false;
    }
    binary.hidden = false;
  } else {
    out.value = t.text;
  }
  sizes.textContent = `${o.text.replace(/\s+/g, '').length.toLocaleString()} Base64 characters decode to ${size(r.bytes.length)}${r.urlSafe ? ' (URL-safe Base64)' : ''}.`;
}

$('[data-copy]').addEventListener('click', () => {
  if (out.value) copyText(out.value, 'Result copied');
});
$('[data-binary-download]').addEventListener('click', () => {
  if (decodedFile) downloadBlob(new Blob([decodedFile.bytes], { type: decodedFile.kind.type }), `decoded.${decodedFile.kind.ext}`);
});
$('[data-swap]').addEventListener('click', () => {
  if (decodedFile || !out.value) return;
  const o = readForm(form);
  input.value = out.value;
  form.querySelector(o.mode === 'decode' ? '#b64-enc' : '#b64-dec').checked = true;
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

// ---- files
const fileOut = $('[data-file-out]');
const fileInfo = $('[data-file-info]');
const fileCopy = $('[data-file-copy]');

function renderFile() {
  if (!file) return;
  const asUrl = readForm(form).fileOut !== 'raw';
  fileOut.value = asUrl ? `data:${file.type};base64,${file.b64}` : file.b64;
  fileCopy.disabled = false;
}

$('[data-file]').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > MAX_FILE) {
    fileInfo.textContent = `${f.name} is ${size(f.size)}. Files over 15 MB are too big to paste anywhere as Base64; link to the file instead.`;
    return;
  }
  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = f.type || sniff(bytes).type;
  file = { name: f.name, type, size: f.size, b64: bytesToBase64(bytes) };
  fileInfo.textContent = `${f.name}: ${size(f.size)}, which becomes ${size(encodedLength(f.size))} of Base64.${f.size > 100 * 1024 ? ' For files this size, a normal link usually loads faster than embedding.' : ''}`;
  renderFile();
});
fileCopy.addEventListener('click', () => {
  if (fileOut.value) copyText(fileOut.value, 'Copied');
});

form.addEventListener('input', (e) => (e.target.name === 'fileOut' ? renderFile() : render()));
form.addEventListener('change', (e) => (e.target.name === 'fileOut' ? renderFile() : render()));
form.addEventListener('submit', (e) => e.preventDefault());
render();
