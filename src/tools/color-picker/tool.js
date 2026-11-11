import { parseColor, formats, toHex, contrast, wcag, formatRatio, readableOn, tintsAndShades, nearestPassing } from './logic.js';
import { readForm, persistForm, copyText, bindColorPairs } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const $ = (sel) => form.querySelector(sel);
const valueBox = form.color;
const native = $('[data-native]');
const hero = $('[data-hero]');
const parseNote = $('[data-parse-note]');
const contrastSection = $('.contrast');

const LABELS = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', hsv: 'HSV / HSB', cmyk: 'CMYK', oklch: 'OKLCH' };
const LEVELS = [
  ['aaNormal', 'AA, normal text', '4.5:1'],
  ['aaLarge', 'AA, large text', '3:1'],
  ['aaaNormal', 'AAA, normal text', '7:1'],
  ['aaaLarge', 'AAA, large text', '4.5:1'],
  ['ui', 'Buttons, icons and borders', '3:1'],
];
const DEFAULT_NOTE = parseNote.innerHTML;

persistForm(form, 'color');
bindColorPairs(contrastSection);

// color names (teal, rebeccapurple …) are read by the browser itself through a canvas
const probe = document.createElement('canvas').getContext('2d');
function resolve(text) {
  const direct = parseColor(text);
  if (direct) return direct;
  const t = String(text || '').trim();
  if (!/^[a-z]+$/i.test(t) || !probe) return null;
  probe.fillStyle = '#010203';
  probe.fillStyle = t;
  const got = probe.fillStyle;
  return got === '#010203' ? null : parseColor(got);
}

let color = resolve(valueBox.value) || { r: 255, g: 200, b: 61, a: 1 };
let suggestion = null;

function renderColor() {
  const f = formats(color);
  const solid = toHex(color);
  const ink = readableOn(color);
  hero.style.background = f.rgb;
  hero.style.color = toHex(ink);
  $('[data-hero-hex]').textContent = f.hex;
  $('[data-hero-note]').textContent = `${ink.r ? 'White' : 'Black'} text reads best on it (${formatRatio(contrast(color, ink))})`;
  if (native.value !== solid) native.value = solid;
  $('[data-formats]').innerHTML = Object.entries(f)
    .map(([k, v]) => `<div class="formats__row"><dt>${LABELS[k]}</dt><dd><code>${v}</code><button type="button" class="button button--quiet button--small" data-copy-value="${v}" aria-label="Copy ${LABELS[k]} value">Copy</button></dd></div>`)
    .join('');
  $('[data-shades]').innerHTML = tintsAndShades(color)
    .map((c, i) => {
      const hex = toHex(c);
      return `<button type="button" class="shade${i === 4 ? ' is-base' : ''}" style="background:${hex};color:${toHex(readableOn(c))}" data-set="${hex}" aria-label="Use ${hex}"><span>${hex}</span></button>`;
    })
    .join('');
}

function setColor(text, { fromBox = false } = {}) {
  const c = resolve(text);
  if (!c) {
    if (fromBox) {
      valueBox.setAttribute('aria-invalid', 'true');
      parseNote.textContent = 'That isn’t a color this page recognizes. Try #ffc83d, rgb(255, 200, 61), hsl(43, 100%, 62%) or a name like teal.';
    }
    return;
  }
  color = c;
  valueBox.removeAttribute('aria-invalid');
  parseNote.innerHTML = DEFAULT_NOTE;
  if (!fromBox) {
    valueBox.value = text.startsWith('#') || !parseColor(text) ? formats(c).hex : text;
    valueBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  renderColor();
}

// only touch the markup when it changes, so a button isn't swapped out mid-click (a blur fires 'change' first)
function setHTML(el, html) {
  if (el.innerHTML !== html && el.dataset.html !== html) {
    el.innerHTML = html;
    el.dataset.html = html;
  }
}

function renderContrast() {
  const o = readForm(form);
  const fg = parseColor(o.fg);
  const bg = parseColor(o.bg);
  const preview = $('[data-preview]');
  if (!fg || !bg) {
    $('[data-ratio]').textContent = '—';
    setHTML($('[data-levels]'), '');
    setHTML($('[data-suggest]'), 'Enter two colors as hex, like #17212b.');
    return;
  }
  preview.style.color = toHex(fg);
  preview.style.background = toHex(bg);
  preview.style.setProperty('--ui', toHex(fg));
  const ratio = contrast(fg, bg);
  const pass = wcag(ratio);
  $('[data-ratio]').textContent = formatRatio(ratio);
  setHTML($('[data-levels]'), LEVELS.map(
    ([k, label, need]) => `<li class="${pass[k] ? 'is-pass' : 'is-fail'}"><span class="checks-list__mark">${pass[k] ? 'Pass' : 'Fail'}</span><span>${label}</span><span class="checks-list__need">needs ${need}</span></li>`,
  ).join(''));
  suggestion = null;
  const suggest = $('[data-suggest]');
  if (!pass.aaNormal) {
    const better = nearestPassing(fg, bg, 4.5);
    if (better) {
      suggestion = toHex(better);
      setHTML(suggest, `For normal text, the nearest passing text color is <code>${suggestion}</code> (${formatRatio(contrast(better, bg))}). <button type="button" class="link-button" data-apply>Use it</button>`);
    } else {
      setHTML(suggest, 'No shade of this text color passes on this background; try a lighter or darker background.');
    }
  } else {
    setHTML(suggest, pass.aaaNormal ? 'Passes every level.' : 'Passes AA for all text. AAA for normal text needs 7:1.');
  }
}

valueBox.addEventListener('input', () => setColor(valueBox.value, { fromBox: true }));
native.addEventListener('input', () => setColor(native.value));
form.addEventListener('input', (e) => { if (e.target.closest('.contrast')) renderContrast(); });
form.addEventListener('change', (e) => { if (e.target.closest('.contrast')) renderContrast(); });
form.addEventListener('submit', (e) => e.preventDefault());

form.addEventListener('click', (e) => {
  const copy = e.target.closest('[data-copy-value]');
  if (copy) return copyText(copy.dataset.copyValue, `${copy.dataset.copyValue} copied`);
  const shade = e.target.closest('[data-set]');
  if (shade) return setColor(shade.dataset.set);
  const use = e.target.closest('[data-use]');
  if (use) {
    const box = form[use.dataset.use];
    box.value = toHex(color);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return renderContrast();
  }
  if (e.target.closest('[data-swap]')) {
    [form.fg.value, form.bg.value] = [form.bg.value, form.fg.value];
    form.fg.dispatchEvent(new Event('input', { bubbles: true }));
    form.bg.dispatchEvent(new Event('input', { bubbles: true }));
    return renderContrast();
  }
  if (e.target.closest('[data-apply]') && suggestion) {
    form.fg.value = suggestion;
    form.fg.dispatchEvent(new Event('input', { bubbles: true }));
    renderContrast();
  }
});

// ---- pick from the screen (Chrome and Edge on computers)
const dropper = $('[data-eyedropper]');
if ('EyeDropper' in window) {
  dropper.hidden = false;
  dropper.addEventListener('click', async () => {
    try {
      const r = await new window.EyeDropper().open();
      setColor(r.sRGBHex);
    } catch { /* cancelled */ }
  });
}

// ---- pick from an image
const canvas = $('[data-canvas]');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
$('[data-image]').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    $('[data-image-wrap]').hidden = false;
    canvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch {
    parseNote.textContent = 'That image couldn’t be opened. Try a JPG, PNG or WebP file.';
  }
});
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
  const [r, g, b] = ctx.getImageData(Math.min(canvas.width - 1, x), Math.min(canvas.height - 1, y), 1, 1).data;
  setColor(toHex({ r, g, b }));
});

setColor(valueBox.value, { fromBox: true });
renderColor();
renderContrast();
