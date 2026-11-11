import { makeWords, countKeys, scoreTest, speedBand, DURATIONS } from './logic.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const box = document.querySelector('[data-words-box]');
const wordsEl = document.querySelector('[data-words]');
const input = document.querySelector('[data-input]');
const timeEl = document.querySelector('[data-time]');
const liveWpm = document.querySelector('[data-live-wpm]');
const liveAcc = document.querySelector('[data-live-acc]');
const results = document.querySelector('[data-results]');
const wpmEl = results.querySelector('[data-wpm]');
const bestEl = results.querySelector('[data-best]');
const statsEl = results.querySelector('[data-stats]');
const mistakesWrap = results.querySelector('[data-mistakes-wrap]');
const mistakesEl = results.querySelector('[data-mistakes]');

persistForm(form, 'typing');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const stat = (value, label) => `<div class="stat"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;

let words = [];
let spans = [];
let index = 0;
let done = [];
let keys = { total: 0, correct: 0 };
let prevTyped = '';
let startedAt = 0;
let ticker = 0;
let finished = false;
let duration = 60;
let offset = 0;

function settings() {
  const o = readForm(form);
  const d = Number(o.duration);
  return { duration: DURATIONS.includes(d) ? d : 60, punctuation: !!o.punctuation };
}

function addWords(count) {
  const fresh = makeWords(count, { punctuation: settings().punctuation });
  const frag = document.createDocumentFragment();
  for (const w of fresh) {
    const span = document.createElement('span');
    span.className = 'tw';
    span.textContent = w;
    frag.append(span, ' ');
    spans.push(span);
  }
  words.push(...fresh);
  wordsEl.append(frag);
}

function best(d) {
  try { return Number(localStorage.getItem(`tool:typing-best-${d}`)) || 0; } catch { return 0; }
}
function setBest(d, wpm) {
  try { localStorage.setItem(`tool:typing-best-${d}`, String(wpm)); } catch { /* ignore */ }
}

function reset({ focus = true } = {}) {
  clearInterval(ticker);
  ({ duration } = settings());
  words = [];
  spans = [];
  index = 0;
  done = [];
  keys = { total: 0, correct: 0 };
  prevTyped = '';
  startedAt = 0;
  finished = false;
  offset = 0;
  wordsEl.replaceChildren();
  wordsEl.style.transform = '';
  addWords(120);
  spans[0].classList.add('is-current');
  input.value = '';
  input.disabled = false;
  input.placeholder = 'Start typing to begin';
  timeEl.textContent = duration;
  liveWpm.textContent = '0';
  liveAcc.textContent = '—';
  box.classList.remove('is-over');
  results.hidden = true;
  if (focus) input.focus({ preventScroll: true });
}

function elapsed() {
  return startedAt ? Math.min(duration * 1000, Date.now() - startedAt) : 0;
}

function current() {
  return { target: words[index], typed: input.value };
}

function tick() {
  const ms = elapsed();
  timeEl.textContent = Math.max(0, Math.ceil(duration - ms / 1000));
  if (ms >= 2000) { // the first second or two swing wildly, so wait a moment before showing speed
    const s = scoreTest({ words: done, partial: current(), elapsedMs: ms, keys });
    liveWpm.textContent = s.wpm;
    liveAcc.textContent = `${Math.round(s.accuracy)}%`;
  }
  if (ms >= duration * 1000) finish();
}

// keep the current word on the first or second visible line
function follow() {
  const span = spans[index];
  if (!span) return;
  const line = parseFloat(getComputedStyle(wordsEl).lineHeight) || 40;
  const target = Math.max(0, span.offsetTop - line);
  if (target !== offset) {
    offset = target;
    wordsEl.style.transform = `translateY(${-offset}px)`;
  }
}

function submitWord(typed) {
  const target = words[index];
  const span = spans[index];
  done.push({ target, typed });
  span.classList.remove('is-current', 'has-error');
  span.classList.add(typed === target ? 'is-right' : 'is-wrong');
  index++;
  if (index > words.length - 40) addWords(60);
  spans[index].classList.add('is-current');
  follow();
}

function finish() {
  if (finished) return;
  finished = true;
  clearInterval(ticker);
  input.disabled = true;
  box.classList.add('is-over');
  timeEl.textContent = '0';
  const s = scoreTest({ words: done, partial: current(), elapsedMs: duration * 1000, keys });
  const before = best(duration);
  const length = duration < 60 ? `${duration} seconds` : duration === 60 ? '1 minute' : `${duration / 60} minutes`;
  wpmEl.textContent = `${s.wpm} WPM`;
  if (s.wpm > before) {
    setBest(duration, s.wpm);
    bestEl.textContent = before ? `New personal best for ${length}, up from ${before} WPM. ${speedBand(s.wpm)}.` : `${speedBand(s.wpm)}. Your first score for ${length} is saved in this browser.`;
  } else {
    bestEl.textContent = `${speedBand(s.wpm)}. Your best for ${length} is ${before} WPM.`;
  }
  statsEl.innerHTML = [
    stat(`${Math.round(s.accuracy)}%`, 'Accuracy'),
    stat(s.correctWords.toLocaleString(), 'Correct words'),
    stat(s.wrongWords.toLocaleString(), 'Wrong words'),
    stat(s.raw.toLocaleString(), 'Raw WPM, mistakes included'),
  ].join('');
  const seen = new Set();
  const list = s.mistakes.filter((m) => !seen.has(m.target) && seen.add(m.target)).slice(0, 24);
  mistakesWrap.hidden = list.length === 0;
  mistakesEl.innerHTML = list.map((m) => `<li><span class="mistakes__target">${esc(m.target)}</span><span class="mistakes__typed">you typed “${esc(m.typed)}”</span></li>`).join('');
  results.hidden = false;
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

input.addEventListener('input', () => {
  if (finished) return;
  let value = input.value;
  if (!startedAt && value.trim()) {
    startedAt = Date.now();
    input.placeholder = '';
    ticker = setInterval(tick, 200);
  }
  const target = words[index];
  const k = countKeys(target, prevTyped, value);
  keys.total += k.total;
  keys.correct += k.correct;

  // a space (or several words at once from a phone keyboard) finishes words
  while (value.includes(' ')) {
    const cut = value.indexOf(' ');
    const typed = value.slice(0, cut);
    value = value.slice(cut + 1);
    if (typed) submitWord(typed);
  }
  if (input.value !== value) input.value = value;
  prevTyped = value;
  const now = words[index];
  spans[index].classList.toggle('has-error', !!value && !now.startsWith(value));
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    reset();
  } else if (e.key === 'Enter') {
    e.preventDefault(); // Enter works like Space at the end of a word
    if (input.value.trim()) {
      input.value += ' ';
      input.dispatchEvent(new Event('input'));
    }
  }
});
// pasting would make the score meaningless
input.addEventListener('paste', (e) => e.preventDefault());
input.addEventListener('drop', (e) => e.preventDefault());

box.addEventListener('click', () => {
  if (!finished) input.focus();
});
document.querySelector('[data-restart]').addEventListener('click', () => reset());
results.querySelector('[data-again]').addEventListener('click', () => reset());
form.addEventListener('change', () => reset());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && finished) reset();
});
window.addEventListener('resize', () => {
  offset = -1; // force a re-measure
  follow();
});

reset({ focus: false });
