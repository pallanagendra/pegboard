import { rollDice, notation, breakdown, range, PIPS, SIDES, MAX_DICE } from './logic.js';
import { randomInt, prefersLessMotion } from '../../assets/js/random-core.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const tray = form.querySelector('[data-tray]');
const totalEl = form.querySelector('[data-total]');
const breakdownEl = form.querySelector('[data-breakdown]');
const announce = form.querySelector('[data-announce]');
const rangeEl = form.querySelector('[data-range]');
const historyWrap = form.querySelector('[data-history-wrap]');
const historyEl = form.querySelector('[data-history]');
let history = [];
let rolling = null;

persistForm(form, 'dice');

// ---- drawing one die as SVG
const GRID = [28, 50, 72];
const polygon = (n, r, cx = 50, cy = 50, start = -90) =>
  Array.from({ length: n }, (_, k) => {
    const a = ((start + (360 / n) * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const SHAPES = {
  4: { body: '<polygon class="die__body" points="50,7 95,88 5,88"/>', textY: 64 },
  8: { body: '<polygon class="die__body" points="50,4 96,50 50,96 4,50"/><path class="die__edge" d="M4 50h92"/>', textY: 50 },
  10: { body: '<polygon class="die__body" points="50,4 95,44 50,96 5,44"/><path class="die__edge" d="M5 44l45 14 45-14M50 58v38"/>', textY: 38 },
  12: { body: `<polygon class="die__body" points="${polygon(5, 47, 50, 53)}"/><polygon class="die__edge" points="${polygon(5, 25, 50, 53)}"/>`, textY: 54 },
  20: { body: `<polygon class="die__body" points="${polygon(6, 47)}"/><polygon class="die__edge" points="50,9 91,75 9,75"/>`, textY: 55 },
  100: { body: `<polygon class="die__body" points="${polygon(10, 47)}"/>`, textY: 50 },
};

function dieSvg(sides, value) {
  if (sides === 6) {
    const pips = value ? PIPS[value].map((i) => `<circle class="die__pip" cx="${GRID[i % 3]}" cy="${GRID[Math.floor(i / 3)]}" r="8.5"/>`).join('') : '';
    return `<svg viewBox="0 0 100 100"><rect class="die__body" x="6" y="6" width="88" height="88" rx="18"/>${pips}</svg>`;
  }
  const s = SHAPES[sides];
  const digits = String(value ?? '').length;
  const size = digits >= 3 ? 27 : sides === 4 ? 30 : 36;
  const text = value ? `<text class="die__num" x="50" y="${s.textY}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${value}</text>` : '';
  return `<svg viewBox="0 0 100 100">${s.body}${text}</svg>`;
}

function drawTray(sides, values) {
  tray.dataset.size = values.length > 20 ? 's' : values.length > 8 ? 'm' : 'l';
  tray.innerHTML = values.map((v) => `<div class="die die--d${sides}">${dieSvg(sides, v)}</div>`).join('');
}

// ---- settings
function settings() {
  const o = readForm(form);
  return { count: Number(o.count), sides: Number(o.sides) || 6, modifier: o.modifier === '' ? 0 : Number(o.modifier) };
}

function preview() {
  const s = settings();
  const ok = Number.isInteger(s.count) && s.count >= 1 && s.count <= MAX_DICE && SIDES.includes(s.sides);
  if (ok) {
    const r = range(s);
    rangeEl.textContent = `${notation(s)} can total anything from ${r.min} to ${r.max}. The average is ${r.average.toLocaleString(undefined, { maximumFractionDigits: 1 })}.`;
  } else {
    rangeEl.textContent = '';
  }
  return ok;
}

function resetTray() {
  const s = settings();
  if (rolling) return;
  totalEl.textContent = '—';
  breakdownEl.textContent = '';
  if (preview()) drawTray(s.sides, Array(s.count).fill(null));
}

// ---- rolling
function finish(r) {
  rolling = null;
  drawTray(r.sides, r.rolls);
  totalEl.textContent = r.total.toLocaleString();
  breakdownEl.textContent = r.rolls.length > 1 || r.modifier ? breakdown(r) : '';
  const list = r.rolls.length === 1 ? `${r.rolls[0]}` : `${r.rolls.slice(0, -1).join(', ')} and ${r.rolls[r.rolls.length - 1]}`;
  announce.textContent = `Rolled ${notation(r)}: ${list}. Total ${r.total}.`;
  history.unshift({ what: notation(r), detail: r.rolls.length > 1 || r.modifier ? breakdown(r) : `${r.total}` });
  history = history.slice(0, 10);
  historyWrap.hidden = history.length < 2;
  historyEl.innerHTML = history
    .slice(1)
    .map((h) => `<li><span class="history__value">${h.what}</span><span class="history__note">${h.detail.length > 120 ? `${h.detail.slice(0, 117)}…` : h.detail}</span></li>`)
    .join('');
}

function roll() {
  if (rolling) return;
  const r = rollDice(settings());
  if (r.error) {
    totalEl.textContent = '—';
    breakdownEl.textContent = r.error;
    announce.textContent = r.error;
    return;
  }
  if (prefersLessMotion()) {
    finish(r);
    return;
  }
  // tumble: show random faces for a moment, then settle on the real roll
  let ticks = 0;
  totalEl.textContent = '…';
  breakdownEl.textContent = '';
  rolling = setInterval(() => {
    ticks++;
    if (ticks > 7) {
      clearInterval(rolling);
      finish(r);
      return;
    }
    drawTray(r.sides, r.rolls.map(() => randomInt(1, r.sides)));
    tray.classList.toggle('is-rolling', true);
  }, 70);
  setTimeout(() => tray.classList.remove('is-rolling'), 600);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  roll();
});

form.querySelectorAll('[data-step]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const now = Number(form.count.value) || 1;
    form.count.value = Math.min(MAX_DICE, Math.max(1, now + Number(btn.dataset.step)));
    form.count.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

form.addEventListener('input', (e) => {
  if (e.target.name === 'count' || e.target.name === 'sides' || e.target.name === 'modifier') resetTray();
});
form.addEventListener('change', (e) => {
  if (e.target.name === 'sides') resetTray();
});

resetTray();
