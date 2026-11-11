import { generate, describe, formatValue } from './logic.js';
import { randomInt, prefersLessMotion } from '../../assets/js/random-core.js';
import { readForm, persistForm, copyText } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const draw = document.querySelector('[data-draw]');
const describeEl = document.querySelector('[data-describe]');
const copyBtn = document.querySelector('[data-copy]');
const historyWrap = document.querySelector('[data-history-wrap]');
const historyEl = document.querySelector('[data-history]');
const LIST_LIMIT = 300; // longer draws show as plain text
let history = [];
let lastText = '';
let flicker;

persistForm(form, 'rng');

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// the newest draw is on screen already; the list shows the ones before it
function renderHistory() {
  const earlier = history.slice(1);
  historyWrap.hidden = earlier.length === 0;
  historyEl.innerHTML = earlier.map((h) => `<li><span class="history__value">${esc(h.text)}</span><span class="history__note">${esc(h.note)}</span></li>`).join('');
}

function showResult(o, r) {
  clearInterval(flicker);
  if (r.error) {
    draw.innerHTML = `<p class="message message--error mt-0">${esc(r.error)}</p>`;
    describeEl.hidden = true;
    copyBtn.hidden = true;
    return;
  }
  const note = describe(o, r.low, r.high) + (r.swapped ? '. Lowest and highest were the wrong way round, so they were swapped' : '');
  lastText = r.numbers.join(', ');
  copyBtn.hidden = false;
  describeEl.textContent = note;
  describeEl.hidden = false;

  if (r.numbers.length === 1) {
    const out = document.createElement('output');
    out.className = 'draw__single';
    draw.replaceChildren(out);
    const final = r.numbers[0];
    if (prefersLessMotion()) {
      out.textContent = final;
    } else {
      // a short shuffle of nearby-sized numbers before the real one settles
      let ticks = 0;
      const lo = Math.ceil(r.low);
      const hi = Math.floor(r.high);
      flicker = setInterval(() => {
        ticks++;
        if (ticks > 8 || hi < lo || hi - lo > 2 ** 52) {
          clearInterval(flicker);
          out.textContent = final;
          out.classList.add('is-final');
          return;
        }
        out.textContent = formatValue(randomInt(lo, hi), 0);
      }, 45);
    }
  } else if (r.numbers.length <= LIST_LIMIT) {
    draw.innerHTML = `<ol class="number-list">${r.numbers.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>`;
  } else {
    draw.innerHTML = `<textarea class="textarea textarea--mono" readonly rows="8" aria-label="Generated numbers">${esc(lastText)}</textarea>`;
  }

  history.unshift({ text: r.numbers.length > 12 ? `${r.numbers.slice(0, 12).join(', ')} … (${r.numbers.length.toLocaleString()} in all)` : lastText, note: describe(o, r.low, r.high) });
  history = history.slice(0, 9);
  renderHistory();
}

function run() {
  const o = readForm(form);
  showResult(o, generate(o));
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  run();
});

form.querySelectorAll('[data-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    const [min, max, count, ...flags] = chip.dataset.preset.split(',');
    form.min.value = min;
    form.max.value = max;
    form.count.value = count;
    form.decimals.value = '0';
    form.unique.checked = flags.includes('unique');
    form.sort.checked = flags.includes('sort');
    form.dispatchEvent(new Event('input')); // save the new settings
    run();
  });
});

copyBtn.addEventListener('click', () => {
  if (lastText) copyText(lastText, 'Numbers copied');
});

renderHistory();
