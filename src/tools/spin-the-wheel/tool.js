import { parseEntries, planSpin, removeEntry, slicePath, sliceColours, MAX_ENTRIES } from './logic.js';
import { shuffle, prefersLessMotion } from '../../assets/js/random-core.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const disc = form.querySelector('[data-disc]');
const box = form.entries;
const countEl = form.querySelector('[data-count]');
const winnerBox = form.querySelector('[data-winner]');
const winnerName = form.querySelector('[data-winner-name]');
const announce = form.querySelector('[data-announce]');
const spinBtn = form.querySelector('[data-spin]');
const hub = form.querySelector('[data-spin-hub]');
const historyWrap = form.querySelector('[data-history-wrap]');
const historyEl = form.querySelector('[data-history]');

// light fills that keep dark text readable in both themes
const PALETTE = ['#ffc83d', '#8fd3c7', '#f6a27a', '#a9c4ff', '#f2a7c3', '#b7dc8a', '#d1b3ff', '#ffe08a'];
const SPIN_MS = 5200;

let rotation = 0;
let spinning = false;
let lastWinner = null;
let pendingRemoval = null;
let winners = [];

persistForm(form, 'wheel');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function label(text, n) {
  const max = n <= 6 ? 18 : n <= 12 ? 16 : n <= 30 ? 14 : 12;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function drawWheel() {
  const { entries, truncated } = parseEntries(box.value);
  const n = entries.length;
  countEl.textContent = n === 0 ? 'No entries yet' : `${n} ${n === 1 ? 'entry' : 'entries'}${truncated ? ` (only the first ${MAX_ENTRIES} are used)` : ''}`;
  spinBtn.disabled = n < 1;
  hub.disabled = n < 1;
  if (!n) {
    disc.innerHTML = '<circle class="wheel__empty" r="100"/><text class="wheel__empty-text" y="34" text-anchor="middle">Add entries to spin</text><circle class="wheel__rim" r="101"/>';
    return entries;
  }
  const seg = 360 / n;
  const colours = sliceColours(n, PALETTE.length);
  const size = n <= 6 ? 10.5 : n <= 12 ? 8.5 : n <= 24 ? 6.5 : n <= 60 ? 4.6 : 3;
  const slices = entries
    .map((e, i) => {
      const a = i * seg;
      const mid = a + seg / 2;
      const text = n <= 120 ? `<text class="wheel__label" transform="rotate(${(mid - 90).toFixed(3)}) translate(91 0)" font-size="${size}" text-anchor="end" dominant-baseline="central">${esc(label(e, n))}</text>` : '';
      return `<path class="wheel__slice" d="${slicePath(a, a + seg)}" fill="${PALETTE[colours[i]]}"/>${text}`;
    })
    .join('');
  disc.innerHTML = `${slices}<circle class="wheel__rim" r="101"/>`;
  return entries;
}

function setRotation(deg, animate) {
  disc.style.transition = animate ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.08, 1)` : 'none';
  disc.style.transform = `rotate(${deg}deg)`;
}

function applyPendingRemoval() {
  if (pendingRemoval == null) return;
  box.value = removeEntry(box.value, pendingRemoval);
  pendingRemoval = null;
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

function spin() {
  if (spinning) return;
  applyPendingRemoval();
  const entries = drawWheel();
  if (!entries.length) return;
  const plan = planSpin(rotation, entries.length);
  spinning = true;
  form.classList.add('is-spinning');
  box.readOnly = true;
  winnerBox.hidden = true;
  announce.textContent = 'Spinning…';
  rotation = plan.rotation;
  setRotation(rotation, true);

  const done = () => {
    if (!spinning) return;
    spinning = false;
    form.classList.remove('is-spinning');
    box.readOnly = false;
    const winner = entries[plan.index];
    lastWinner = winner;
    winnerName.textContent = winner;
    winnerBox.hidden = false;
    announce.textContent = `The winner is ${winner}.`;
    winners.push(winner); // in the order they were picked, which doubles as a running order
    winners = winners.slice(-200);
    historyWrap.hidden = false;
    historyEl.innerHTML = winners.map((w) => `<li><span class="history__value">${esc(w)}</span></li>`).join('');
    if (readForm(form).autoRemove) {
      pendingRemoval = winner;
      setTimeout(() => { if (!spinning) applyPendingRemoval(); }, 1600);
    }
  };
  disc.addEventListener('transitionend', done, { once: true });
  setTimeout(done, prefersLessMotion() ? 60 : SPIN_MS + 300);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  spin();
});
hub.addEventListener('click', spin);

box.addEventListener('input', () => {
  if (!spinning) drawWheel();
});

form.querySelector('[data-remove-winner]').addEventListener('click', () => {
  if (lastWinner == null || spinning) return;
  pendingRemoval = null;
  box.value = removeEntry(box.value, lastWinner);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  winnerBox.hidden = true;
  lastWinner = null;
});

form.querySelector('[data-shuffle]').addEventListener('click', () => {
  if (spinning) return;
  box.value = shuffle(parseEntries(box.value).entries).join('\n');
  box.dispatchEvent(new Event('input', { bubbles: true }));
});
form.querySelector('[data-sort]').addEventListener('click', () => {
  if (spinning) return;
  box.value = parseEntries(box.value).entries.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).join('\n');
  box.dispatchEvent(new Event('input', { bubbles: true }));
});
form.querySelector('[data-clear]').addEventListener('click', () => {
  if (spinning) return;
  box.value = '';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
});

setRotation(0, false);
drawWheel();
