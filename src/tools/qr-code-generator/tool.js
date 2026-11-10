import { buildPayload, contrastRatio, isDarkOnLight, modulesToPath, modulesToDots, inFinder } from './logic.js';
import { readForm, bindRangeOutputs, bindColorPairs, persistForm, downloadSvg, svgToPngBlob, downloadBlob, copyText, fileSlug, debounce } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const stage = document.querySelector('[data-stage]');
const errorBox = document.querySelector('[data-error]');
const warnBox = document.querySelector('[data-warn]');
const info = document.querySelector('[data-info]');
const buttons = document.querySelectorAll('[data-download], [data-copy-payload]');
const SVG_NS = 'http://www.w3.org/2000/svg';
const HEX = /^#[0-9a-f]{6}$/i;

bindRangeOutputs(form);
bindColorPairs(form);
persistForm(form, 'qr');

let current = null; // { svg, payload }

function showTypeFields(type) {
  form.querySelectorAll('[data-type-fields]').forEach((el) => {
    el.hidden = el.dataset.typeFields !== type;
  });
}

function setError(message) {
  errorBox.textContent = message || '';
  errorBox.hidden = !message;
  stage.style.opacity = message ? '0.35' : '1';
  buttons.forEach((b) => { b.disabled = !!message; });
}

function render() {
  const o = readForm(form);
  showTypeFields(o.type);
  const result = buildPayload(o.type, o);
  if (!result.ok) {
    setError(result.message);
    return;
  }

  const qrcode = window.qrcode;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  let qr;
  try {
    qr = qrcode(0, o.ecc);
    qr.addData(result.payload, 'Byte');
    qr.make();
  } catch {
    setError('That is too much content for one QR code. Shorten it, or set error correction to Low.');
    return;
  }

  const fg = HEX.test(o.fg) ? o.fg : '#111111';
  const bg = HEX.test(o.bg) ? o.bg : '#ffffff';
  const count = qr.getModuleCount();
  const margin = Number(o.margin);
  const total = count + margin * 2;
  const isDark = (r, c) => qr.isDark(r, c);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('width', String(o.size));
  svg.setAttribute('height', String(o.size));
  svg.setAttribute('shape-rendering', o.style === 'dots' ? 'geometricPrecision' : 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code preview');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', String(total));
  rect.setAttribute('height', String(total));
  rect.setAttribute('fill', bg);
  svg.appendChild(rect);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', fg);
  if (o.style === 'dots') {
    // keep the three finder squares solid so phones lock on reliably
    const finders = modulesToPath(count, (r, c) => inFinder(count, r, c) && isDark(r, c), margin);
    const dots = modulesToDots(count, (r, c) => !inFinder(count, r, c) && isDark(r, c), margin);
    path.setAttribute('d', finders + dots);
  } else {
    path.setAttribute('d', modulesToPath(count, isDark, margin));
  }
  svg.appendChild(path);

  stage.replaceChildren(svg);
  setError('');
  current = { svg, payload: result.payload };
  info.textContent = `${count} × ${count} modules`;

  // warn about combinations that commonly fail to scan
  const warnings = [];
  if (!isDarkOnLight(fg, bg)) warnings.push('Light modules on a dark background won’t scan on many phones. Swap the colors.');
  else if (contrastRatio(fg, bg) < 4) warnings.push('Low contrast between the colors. Make the foreground darker or the background lighter so it scans reliably.');
  if (margin < 2) warnings.push('A quiet zone under 2 modules can stop the code scanning when it’s printed next to other things.');
  if (count > 77) warnings.push('This is a dense code. Print it larger, or shorten the content.');
  warnBox.textContent = warnings.join(' ');
  warnBox.hidden = warnings.length === 0;
}

const filename = (ext) => {
  const o = readForm(form);
  const hint = { url: o.url, text: 'text', wifi: `wifi-${o.wifiSsid}`, email: o.emailTo, phone: 'phone', sms: 'sms', vcard: `${o.vcFirst}-${o.vcLast}` }[o.type];
  return `qr-${fileSlug(hint, o.type)}.${ext}`;
};

document.querySelector('[data-download="svg"]').addEventListener('click', () => current && downloadSvg(current.svg, filename('svg')));
document.querySelector('[data-download="png"]').addEventListener('click', async () => {
  if (!current) return;
  const blob = await svgToPngBlob(current.svg, 1);
  downloadBlob(blob, filename('png'));
});
document.querySelector('[data-copy-payload]').addEventListener('click', () => current && copyText(current.payload, 'Encoded text copied'));

form.addEventListener('input', debounce(render, 80));
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());

if (window.qrcode) render();
else window.addEventListener('load', render);
