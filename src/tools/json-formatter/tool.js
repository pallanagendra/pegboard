import { check, format, stats, highlight } from './logic.js';
import { readForm, persistForm, copyText, downloadBlob, debounce } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const input = form.json;
const status = form.querySelector('[data-status]');
const outWrap = form.querySelector('[data-out]');
const code = form.querySelector('[data-code]');
const statsEl = form.querySelector('[data-stats]');
const outActions = form.querySelector('[data-out-actions]');
const HIGHLIGHT_LIMIT = 400000; // coloring very large files would slow typing down
let output = '';
let mode = 'format';

const EXAMPLE = `{"site":"Pegboard","tools":[{"name":"QR code generator","category":"generators","free":true,"tags":["qr","wifi","vcard"]},{"name":"JSON formatter","category":"web","free":true,"rating":4.9}],"private":true,"uploads":null}`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kb = (chars) => {
  const bytes = new Blob([chars]).size;
  return bytes < 1024 ? `${bytes} bytes` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
};

persistForm(form, 'json');

function showError(text, err) {
  const lines = text.split('\n');
  const line = lines[err.line - 1] ?? '';
  // long lines (minified JSON) are cut to a window around the problem
  const from = Math.max(0, err.column - 41);
  const shown = (from > 0 ? '…' : '') + line.slice(from, from + 80).replace(/\t/g, ' ') + (line.length > from + 80 ? '…' : '');
  const caretAt = err.column - 1 - from + (from > 0 ? 1 : 0);
  const gutter = String(err.line);
  status.innerHTML = `
    <div class="message message--error json-error">
      <p class="mt-0"><strong>Line ${err.line}, column ${err.column}:</strong> ${esc(err.message)}</p>
      <pre class="json-error__snippet"><span class="json-error__gutter">${gutter} │</span> ${esc(shown)}\n<span class="json-error__gutter">${' '.repeat(gutter.length)} │</span> ${' '.repeat(Math.max(0, caretAt))}^</pre>
      <button type="button" class="button button--small" data-goto>Show in the box</button>
    </div>`;
  status.querySelector('[data-goto]').addEventListener('click', () => {
    input.focus();
    input.setSelectionRange(err.at, Math.min(text.length, err.at + 1));
    // move the textarea so the selected spot is visible
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = Math.max(0, (err.line - 3) * lineHeight);
  });
}

function render() {
  const o = readForm(form);
  mode = o.mode;
  const text = o.json || '';
  output = '';
  if (!text.trim()) {
    status.innerHTML = '<p class="message message--note mt-0">Paste JSON on the left, open a file or try the example. It’s checked and formatted as you type.</p>';
    outWrap.hidden = true;
    outActions.hidden = true;
    statsEl.textContent = '';
    input.removeAttribute('aria-invalid');
    return;
  }
  const r = check(text);
  if (r.error) {
    input.setAttribute('aria-invalid', 'true');
    showError(r.text, r.error);
    outWrap.hidden = true;
    outActions.hidden = true;
    statsEl.textContent = '';
    return;
  }
  input.removeAttribute('aria-invalid');
  output = format(r.value, { indent: mode === 'minify' ? 0 : o.indent, sortKeys: o.sortKeys });
  const notes = r.notes.longNumbers.length
    ? ` <span class="json-warn">But ${r.notes.longNumbers.length === 1 ? `the number ${esc(r.notes.longNumbers[0].text.slice(0, 24))}` : `${r.notes.longNumbers.length} numbers`} ${r.notes.longNumbers.length === 1 ? 'is' : 'are'} too long to keep exactly; in the result ${r.notes.longNumbers.length === 1 ? 'it' : 'they'} may end in different digits. IDs like these are safer as strings.</span>`
    : '';
  status.innerHTML = `<p class="message message--ok mt-0"><strong>Valid JSON.</strong>${notes}</p>`;
  if (output.length <= HIGHLIGHT_LIMIT) code.innerHTML = highlight(output);
  else code.textContent = output;
  outWrap.hidden = false;
  outActions.hidden = false;
  const s = stats(r.value);
  const shape = s.type === 'object' ? `An object with ${s.keys.toLocaleString()} key${s.keys === 1 ? '' : 's'} in all` : s.type === 'array' ? `A list of ${s.items.toLocaleString()} item${s.items === 1 ? '' : 's'} in all` : `A single ${s.type}`;
  statsEl.textContent = `${shape}${s.depth > 1 ? `, nested ${s.depth} levels deep` : ''}. ${kb(text)} in, ${kb(output)} out.`;
}

const later = debounce(render, 150);
form.addEventListener('input', (e) => (e.target === input ? later() : render()));
form.addEventListener('change', (e) => { if (e.target !== input) render(); });
form.addEventListener('submit', (e) => e.preventDefault());

form.querySelector('[data-copy]').addEventListener('click', () => {
  if (output) copyText(output, mode === 'minify' ? 'Minified JSON copied' : 'Formatted JSON copied');
});
form.querySelector('[data-download]').addEventListener('click', () => {
  if (output) downloadBlob(new Blob([output + (mode === 'minify' ? '' : '\n')], { type: 'application/json' }), mode === 'minify' ? 'minified.json' : 'formatted.json');
});
form.querySelector('[data-example]').addEventListener('click', () => {
  input.value = EXAMPLE;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  render();
});
form.querySelector('[data-clear]').addEventListener('click', () => {
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  render();
  input.focus();
});
form.querySelector('[data-open]').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 25 * 1048576) {
    status.innerHTML = '<p class="message message--error mt-0">That file is over 25 MB, which is too big to format in a browser tab.</p>';
    return;
  }
  input.value = await file.text();
  input.dispatchEvent(new Event('input', { bubbles: true }));
  render();
});

render();
