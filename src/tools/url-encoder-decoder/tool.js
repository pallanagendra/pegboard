import { ENCODINGS, encode, decode, parseUrl } from './logic.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const input = form.querySelector('#u-in');
const output = form.querySelector('#u-out');
const status = form.querySelector('[data-status]');
const partsPanel = document.querySelector('[data-parts-panel]');
const partsTable = document.querySelector('[data-parts]');
const paramCount = document.querySelector('[data-param-count]');
const variantSelect = form.querySelector('[data-variants]');
const variantHelp = form.querySelector('[data-variant-help]');

variantSelect.innerHTML = Object.entries(ENCODINGS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
persistForm(form, 'url');

function row(label, value, sub = false) {
  const tr = document.createElement('tr');
  if (sub) tr.className = 'kv__sub';
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  const td = document.createElement('td');
  td.textContent = value === '' ? '(empty)' : value;
  tr.append(th, td);
  return tr;
}

function render() {
  const o = readForm(form);
  const decoding = o.mode === 'decode';
  form.querySelector('[data-encode-opts]').hidden = decoding;
  form.querySelector('[data-decode-opts]').hidden = !decoding;
  form.querySelector('[data-in-label]').textContent = decoding ? 'Encoded text or link' : 'Plain text';
  form.querySelector('[data-out-label]').textContent = decoding ? 'Decoded' : 'Encoded';
  variantHelp.textContent = ENCODINGS[o.variant]?.help || '';

  const messages = [];
  if (decoding) {
    const r = decode(o.input, { plusAsSpace: o.plusAsSpace, repeat: o.repeat });
    output.value = r.text;
    if (o.repeat && r.passes > 1) messages.push(`Removed ${r.passes} layers of encoding.`);
    if (r.bad) messages.push(`${r.bad} % sequence${r.bad > 1 ? 's were' : ' was'} not valid and ${r.bad > 1 ? 'were' : 'was'} left as typed.`);
  } else {
    try {
      output.value = encode(o.input, o.variant);
    } catch {
      output.value = '';
      messages.push('The text contains a broken character (an unpaired surrogate) that can’t be encoded. Re-copy it from the source.');
    }
  }
  status.textContent = messages.join(' ');
  status.hidden = messages.length === 0;

  // Break down whichever side is a real URL — prefer the readable one.
  const parsed = parseUrl(decoding ? o.input.trim() : output.value) || parseUrl(o.input.trim());
  partsPanel.hidden = !parsed;
  if (parsed) {
    partsTable.replaceChildren(...parsed.parts.map(([k, v]) => row(k, v)));
    if (parsed.params.length) {
      partsTable.append(row('Query parameters', `${parsed.params.length}`));
      parsed.params.forEach(([k, v]) => partsTable.append(row(k, v, true)));
    }
    paramCount.textContent = parsed.params.length ? `${parsed.params.length} parameter${parsed.params.length > 1 ? 's' : ''}` : '';
  }
}

form.querySelector('[data-swap]').addEventListener('click', () => {
  const mode = readForm(form).mode;
  input.value = output.value;
  form.querySelector(mode === 'decode' ? '#u-enc' : '#u-dec').checked = true;
  form.dispatchEvent(new Event('input'));
  render();
});
form.querySelector('[data-clear]').addEventListener('click', () => {
  input.value = '';
  form.dispatchEvent(new Event('input'));
  render();
  input.focus();
});

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
