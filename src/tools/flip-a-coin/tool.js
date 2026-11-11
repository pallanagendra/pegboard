import { flip, flipMany, tally } from './logic.js';
import { prefersLessMotion } from '../../assets/js/random-core.js';

const coin = document.querySelector('[data-coin]');
const stage = coin.closest('.coin-stage');
const result = document.querySelector('[data-result]');
const stats = document.querySelector('[data-stats]');
const log = document.querySelector('[data-log]');
const manyNote = document.querySelector('[data-many-note]');
const STORE = 'tool:coin-log';
const MAX_KEPT = 100000;

// flips are stored as a compact "HTTH…" string so a refresh keeps the tally
let flips = [];
try {
  flips = [...(sessionStorage.getItem(STORE) || '')].map((c) => (c === 'H' ? 'heads' : 'tails'));
} catch { /* storage unavailable */ }

function save() {
  try { sessionStorage.setItem(STORE, flips.map((f) => (f === 'heads' ? 'H' : 'T')).join('')); } catch { /* ignore */ }
}

const word = (side) => (side === 'heads' ? 'Heads' : 'Tails');
const pct = (n) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const stat = (value, label, key = false) => `<div class="stat${key ? ' stat--key' : ''}"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;

function renderTally() {
  const t = tally(flips);
  stats.innerHTML = [
    stat(t.heads.toLocaleString(), `Heads${t.total ? `, ${pct(t.headsPct)}` : ''}`),
    stat(t.tails.toLocaleString(), `Tails${t.total ? `, ${pct(t.tailsPct)}` : ''}`),
    stat(t.total.toLocaleString(), 'Flips'),
    stat(t.streak.length ? `${t.streak.length} ${word(t.streak.side).toLowerCase()}` : '—', t.longest.length > 1 ? `Current streak. Longest: ${t.longest.length} ${word(t.longest.side).toLowerCase()}` : 'Current streak'),
  ].join('');
  const recent = flips.slice(-40).reverse();
  log.innerHTML = recent.length
    ? recent.map((f) => `<li class="flip-log__item flip-log__item--${f}" title="${word(f)}">${f === 'heads' ? 'H' : 'T'}</li>`).join('')
    : '<li class="flip-log__empty">No flips yet</li>';
}

// the coin keeps turning the same way; each flip adds whole turns and lands on the right face
let rotation = 0;
let busy = false;

function land(side) {
  const target = side === 'heads' ? 0 : 180;
  const current = ((rotation % 360) + 360) % 360;
  const turns = prefersLessMotion() ? 0 : 5;
  rotation += turns * 360 + ((target - current + 360) % 360);
  if (turns === 0 && current === target) rotation += 360; // still show *something* happened
  return rotation;
}

function doFlip() {
  if (busy) return;
  const side = flip();
  busy = true;
  manyNote.hidden = true;
  result.textContent = 'Flipping…';
  stage.classList.remove('is-tossing');
  void stage.offsetWidth; // restart the toss animation
  stage.classList.add('is-tossing');
  coin.style.transform = `rotateY(${land(side)}deg)`;
  const done = () => {
    if (!busy) return;
    busy = false;
    flips.push(side);
    if (flips.length > MAX_KEPT) flips = flips.slice(-MAX_KEPT);
    save();
    result.textContent = word(side);
    result.dataset.side = side;
    renderTally();
  };
  coin.addEventListener('transitionend', done, { once: true });
  setTimeout(done, prefersLessMotion() ? 50 : 1400); // in case transitionend never fires
}

document.querySelector('[data-flip]').addEventListener('click', doFlip);

document.querySelectorAll('[data-flip-many]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (busy) return;
    const n = Number(btn.dataset.flipMany);
    const batch = flipMany(n);
    flips.push(...batch);
    if (flips.length > MAX_KEPT) flips = flips.slice(-MAX_KEPT);
    save();
    const t = tally(batch);
    const last = batch[batch.length - 1];
    coin.style.transform = `rotateY(${land(last)}deg)`;
    result.textContent = word(last);
    result.dataset.side = last;
    manyNote.textContent = `${n} flips: ${t.heads} heads and ${t.tails} tails. The coin shows the last one.`;
    manyNote.hidden = false;
    renderTally();
  });
});

document.querySelector('[data-reset]').addEventListener('click', () => {
  flips = [];
  save();
  manyNote.hidden = true;
  result.textContent = 'Ready to flip';
  delete result.dataset.side;
  renderTally();
});

if (flips.length) {
  const last = flips[flips.length - 1];
  rotation = last === 'heads' ? 0 : 180;
  coin.style.transition = 'none';
  coin.style.transform = `rotateY(${rotation}deg)`;
  void coin.offsetWidth;
  coin.style.transition = '';
}
renderTally();
