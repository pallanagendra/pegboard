import { FORMATS, validate } from './logic.js';
import { readForm, bindRangeOutputs, bindColorPairs, persistForm, downloadSvg, downloadSvgAsPng, copyText, fileSlug, debounce } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const select = form.querySelector('[data-format]');
const hint = form.querySelector('[data-hint]');
const dataInput = form.querySelector('#bc-data');
const svg = document.querySelector('[data-svg]');
const stage = document.querySelector('[data-stage]');
const errorBox = document.querySelector('[data-error]');
const noteBox = document.querySelector('[data-note]');
const sizeLabel = document.querySelector('[data-size]');
const buttons = document.querySelectorAll('[data-download], [data-copy-svg]');

select.innerHTML = Object.entries(FORMATS)
  .map(([key, f]) => `<option value="${key}">${f.label}</option>`)
  .join('');

bindRangeOutputs(form);
bindColorPairs(form);
persistForm(form, 'barcode');

let lastGood = false;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
  dataInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function render() {
  const o = readForm(form);
  hint.textContent = FORMATS[o.format]?.hint || '';
  const check = validate(o.format, o.data);
  noteBox.hidden = !check.note;
  noteBox.textContent = check.note || '';

  if (!check.ok) {
    showError(check.message);
    setReady(false);
    return;
  }

  const hex = /^#[0-9a-f]{6}$/i;
  let libraryOk = true;
  try {
    window.JsBarcode(svg, check.value, {
      format: o.format,
      width: o.width,
      height: o.height,
      margin: o.margin,
      fontSize: o.fontSize,
      displayValue: o.displayValue,
      lineColor: hex.test(o.lineColor) ? o.lineColor : '#000000',
      background: o.transparent ? 'transparent' : hex.test(o.background) ? o.background : '#ffffff',
      font: 'monospace',
      textMargin: 4,
      xmlDocument: document,
      valid: (ok) => { libraryOk = ok; },
    });
  } catch (err) {
    libraryOk = false;
  }

  if (!libraryOk) {
    showError(`This value can't be encoded as ${FORMATS[o.format].label}. ${FORMATS[o.format].hint}`);
    setReady(false);
    return;
  }

  showError('');
  setReady(true);
  const w = svg.getAttribute('width');
  const h = svg.getAttribute('height');
  if (w && h) {
    svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    sizeLabel.textContent = `${parseFloat(w)} × ${parseFloat(h)} px`;
  }
}

function setReady(ok) {
  lastGood = ok;
  stage.style.opacity = ok ? '1' : '0.35';
  buttons.forEach((b) => { b.disabled = !ok; });
}

form.addEventListener('input', debounce(render, 60));
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());

form.querySelector('[data-example]').addEventListener('click', () => {
  dataInput.value = FORMATS[select.value].example;
  dataInput.dispatchEvent(new Event('input', { bubbles: true }));
  render();
  dataInput.focus();
});

const filename = (ext) => `barcode-${select.value.toLowerCase()}-${fileSlug(dataInput.value, 'code')}.${ext}`;

document.querySelector('[data-download="svg"]').addEventListener('click', () => lastGood && downloadSvg(svg, filename('svg')));
document.querySelector('[data-download="png"]').addEventListener('click', () => lastGood && downloadSvgAsPng(svg, filename('png'), 4));
document.querySelector('[data-copy-svg]').addEventListener('click', () => {
  if (!lastGood) return;
  const clone = svg.cloneNode(true);
  clone.removeAttribute('data-svg');
  clone.removeAttribute('style');
  copyText(new XMLSerializer().serializeToString(clone), 'SVG code copied');
});

// The library loads with `defer`; module scripts run after deferred scripts, so it's ready here.
if (window.JsBarcode) render();
else window.addEventListener('load', render);
