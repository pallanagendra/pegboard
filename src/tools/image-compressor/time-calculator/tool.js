import { sumDurations, formatDuration, formatClockDuration, decimalHours, parseClock, timeBetween, addToClock, formatClock } from './logic.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const rowsBox = form.querySelector('[data-rows]');
const rowsState = form.querySelector('[data-rows-state]');
const DEFAULT_ROWS = [{ sign: '+', h: '2', m: '30', s: '' }, { sign: '+', h: '1', m: '45', s: '' }, { sign: '+', h: '3', m: '15', s: '' }, { sign: '-', h: '', m: '30', s: '' }];

persistForm(form, 'time');

// ---- duration rows (kept in a hidden field so they survive a refresh)
let rowCount = 0;
function addRow(r = { sign: '+', h: '', m: '', s: '' }, focus = false) {
  const i = ++rowCount;
  const row = document.createElement('div');
  row.className = 'duration-row';
  row.innerHTML = `
    <select class="select" aria-label="Add or subtract row ${i}" data-k="sign"><option value="+">+</option><option value="-">−</option></select>
    <input class="input" inputmode="decimal" autocomplete="off" aria-label="Hours, row ${i}" placeholder="0" data-k="h">
    <input class="input" inputmode="decimal" autocomplete="off" aria-label="Minutes, row ${i}" placeholder="0" data-k="m">
    <input class="input" inputmode="decimal" autocomplete="off" aria-label="Seconds, row ${i}" placeholder="0" data-k="s">
    <button type="button" class="icon-button" aria-label="Remove row ${i}" data-remove><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  for (const el of row.querySelectorAll('[data-k]')) el.value = r[el.dataset.k] ?? '';
  row.querySelector('[data-remove]').addEventListener('click', () => {
    row.remove();
    if (!rowsBox.querySelector('.duration-row:not(.duration-row--head)')) addRow();
    changed();
  });
  rowsBox.append(row);
  if (focus) row.querySelector('[data-k="h"]').focus();
}

function readRows() {
  return [...rowsBox.querySelectorAll('.duration-row:not(.duration-row--head)')].map((row) =>
    Object.fromEntries([...row.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.value])),
  );
}

function changed() {
  rowsState.value = JSON.stringify(readRows());
  form.dispatchEvent(new Event('input')); // saves the form and re-renders
}

let saved = [];
try {
  saved = JSON.parse(rowsState.value || '[]');
} catch {
  saved = [];
}
(saved.length ? saved : DEFAULT_ROWS).forEach((r) => addRow(r));
rowsState.value = JSON.stringify(readRows());

form.querySelector('[data-add-row]').addEventListener('click', () => {
  addRow(undefined, true);
  changed();
});
form.querySelector('[data-reset-rows]').addEventListener('click', () => {
  rowsBox.querySelectorAll('.duration-row:not(.duration-row--head)').forEach((r) => r.remove());
  DEFAULT_ROWS.forEach((r) => addRow(r));
  changed();
});
rowsBox.addEventListener('input', (e) => {
  if (e.target.matches('[data-k]')) rowsState.value = JSON.stringify(readRows());
});
rowsBox.addEventListener('change', (e) => {
  if (e.target.matches('[data-k]')) rowsState.value = JSON.stringify(readRows());
});

// ---- answers
function show(key, text, formula, error = false) {
  const box = form.querySelector(`[data-answer="${key}"]`);
  box.classList.toggle('answer--error', error);
  box.querySelector('.answer__value').textContent = text;
  const f = box.querySelector('.answer__formula');
  f.textContent = formula || '';
  f.hidden = !formula;
  box.querySelector('[data-copy-from]').hidden = error;
}

const hoursText = (sec) => `${decimalHours(sec).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hours in decimal`;

function render() {
  const o = readForm(form);

  const total = sumDurations(readRows());
  show('sum', formatDuration(total), `${formatClockDuration(total)}, or ${hoursText(total)}`);

  const between = timeBetween(parseClock(o.start), parseClock(o.end), o.breakMin);
  if (between.error) show('between', between.error, '', true);
  else show('between', formatDuration(between.seconds), `${hoursText(between.seconds)}${between.overnight ? '. Ends the next day' : ''}`);

  const clock = parseClock(o.clock);
  if (!Number.isFinite(clock)) {
    show('clock', 'Enter a time.', '', true);
  } else {
    const delta = sumDurations([{ sign: o.op, h: o.addH, m: o.addM }]);
    const r = addToClock(clock, delta);
    const day = r.dayOffset === 0 ? 'Same day' : r.dayOffset === 1 ? 'Next day' : r.dayOffset === -1 ? 'Previous day' : `${Math.abs(r.dayOffset)} days ${r.dayOffset > 0 ? 'later' : 'earlier'}`;
    show('clock', formatClock(r.seconds), `${formatClock(clock)} ${o.op === '-' ? '−' : '+'} ${formatDuration(Math.abs(delta))}. ${day}`);
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
