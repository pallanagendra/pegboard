import { RATIOS, PERMISSIONS, SANDBOX, buildIframe } from './logic.js';
import { readForm, persistForm, debounce } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const code = document.querySelector('[data-code]');
const errorBox = document.querySelector('[data-error]');
const notesBox = document.querySelector('[data-notes]');
const preview = document.querySelector('[data-preview]');
const auto = document.querySelector('[data-autopreview]');
const copyBtn = document.querySelector('[data-copy-from="#if-code"]');

form.querySelector('[data-ratios]').innerHTML = Object.entries(RATIOS).map(([v, label]) => `<option value="${v}">${label}</option>`).join('');

const DEFAULT_ALLOW = ['autoplay', 'clipboard-write', 'encrypted-media', 'picture-in-picture', 'web-share'];
form.querySelector('[data-permissions]').innerHTML = PERMISSIONS.map(
  ([key, label]) => `<label class="check"><input type="checkbox" name="allow_${key}" data-allow="${key}"${DEFAULT_ALLOW.includes(key) ? ' checked' : ''}> <span>${label}</span></label>`,
).join('');
form.querySelector('[data-sandbox]').innerHTML = SANDBOX.map(
  ([key, label]) => `<label class="check"><input type="checkbox" name="sb_${key}" data-sb="${key}"${key === 'allow-scripts' || key === 'allow-same-origin' ? ' checked' : ''}> <span>${label}</span></label>`,
).join('');

persistForm(form, 'iframe');

let lastPreview = '';

function options() {
  const o = readForm(form);
  o.allow = [...form.querySelectorAll('[data-allow]:checked')].map((el) => el.dataset.allow);
  o.sandbox = [...form.querySelectorAll('[data-sb]:checked')].map((el) => el.dataset.sb);
  return o;
}

function render() {
  const o = options();
  form.querySelectorAll('[data-size]').forEach((el) => { el.hidden = el.dataset.size !== o.sizeMode; });
  form.querySelector('[data-sandbox]').hidden = !o.useSandbox;

  const result = buildIframe(o);
  if (!result.ok) {
    errorBox.textContent = result.message;
    errorBox.hidden = false;
    code.textContent = '';
    copyBtn.disabled = true;
    notesBox.hidden = true;
    return;
  }
  errorBox.hidden = true;
  copyBtn.disabled = false;
  code.textContent = result.html;
  notesBox.textContent = result.notes.join(' ');
  notesBox.hidden = result.notes.length === 0;
  if (auto.checked) updatePreview(result.html);
}

const updatePreview = debounce((html) => {
  if (html === lastPreview) return;
  lastPreview = html;
  // Build the element from the generated markup so the preview matches the code exactly.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const frame = doc.querySelector('iframe');
  if (!frame) return;
  preview.replaceChildren(document.importNode(frame, true));
}, 600);

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
auto.addEventListener('change', () => { if (auto.checked) { lastPreview = ''; render(); } });

render();
