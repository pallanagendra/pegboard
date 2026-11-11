import { CASES, convert } from './logic.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const out = form.querySelector('[data-out]');
const counts = form.querySelector('[data-counts]');

// one radio "chip" per case, built from the list so the page and the logic never disagree
form.querySelector('[data-cases]').innerHTML = CASES.map(
  (c, i) => `<input type="radio" name="case" id="cc-${c.id}" value="${c.id}"${i === 0 ? ' checked' : ''}><label for="cc-${c.id}">${c.label}</label>`,
).join('');

persistForm(form, 'case');

function render() {
  const o = readForm(form);
  out.value = convert(o.text, o.case);
  const text = o.text || '';
  const words = (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || []).length;
  const lines = text ? text.split('\n').length : 0;
  counts.textContent = `${[...text].length.toLocaleString()} characters · ${words.toLocaleString()} words${lines > 1 ? ` · ${lines.toLocaleString()} lines` : ''}`;
}

form.querySelector('[data-use]').addEventListener('click', () => {
  form.text.value = out.value;
  form.text.dispatchEvent(new Event('input', { bubbles: true }));
  form.text.focus();
});

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
