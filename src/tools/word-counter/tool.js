import { analyze, LIMITS } from './logic.js';
import { persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const textarea = form.querySelector('[data-text]');
const statsEl = form.querySelector('[data-stats]');
const limitsEl = document.querySelector('[data-limits]');
const keywordsEl = document.querySelector('[data-keywords]');
const kwEmpty = document.querySelector('[data-kw-empty]');
const hideCommon = document.querySelector('[data-hide-common]');

persistForm(form, 'words');

const nf = new Intl.NumberFormat();

// Build the limit bars once, then just update widths.
limitsEl.innerHTML = LIMITS.map(
  (l) => `<div class="limit" data-limit="${l.id}">
    <div class="limit__row"><span>${l.label}</span><span data-limit-count></span></div>
    <div class="limit__bar" role="presentation"><div class="limit__fill"></div></div>
  </div>`,
).join('');

function stat(value, label, key = false) {
  return `<div class="stat${key ? ' stat--key' : ''}"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;
}

let frame;
function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const r = analyze(textarea.value, { hideCommon: hideCommon.checked });
    statsEl.innerHTML = [
      stat(nf.format(r.words), 'Words', true),
      stat(nf.format(r.characters), 'Characters', true),
      stat(nf.format(r.charactersNoSpaces), 'Without spaces'),
      stat(nf.format(r.sentences), 'Sentences'),
      stat(nf.format(r.paragraphs), 'Paragraphs'),
      stat(nf.format(r.lines), 'Lines'),
      stat(r.readingTime, 'Reading time'),
      stat(r.speakingTime, 'Speaking time'),
      stat(nf.format(r.uniqueWords), 'Unique words'),
      stat(r.avgWordLength ? r.avgWordLength.toFixed(1) : '0', 'Avg. word length'),
      stat(nf.format(r.bytes), 'Bytes (UTF-8)'),
      stat(`${r.sms.segments}`, `SMS (${r.sms.encoding})`),
    ].join('');

    for (const l of LIMITS) {
      const el = limitsEl.querySelector(`[data-limit="${l.id}"]`);
      const pct = Math.min(100, (r.characters / l.max) * 100);
      el.querySelector('.limit__fill').style.width = `${pct}%`;
      el.querySelector('[data-limit-count]').textContent = `${nf.format(r.characters)} / ${nf.format(l.max)}`;
      el.classList.toggle('limit--over', r.characters > l.max);
    }

    keywordsEl.replaceChildren(
      ...r.keywords.map((k) => {
        const li = document.createElement('li');
        const w = document.createElement('span');
        w.textContent = k.word;
        const c = document.createElement('span');
        c.textContent = `${k.count}×`;
        const p = document.createElement('span');
        p.textContent = `${k.percent.toFixed(1)}%`;
        li.append(w, c, p);
        return li;
      }),
    );
    kwEmpty.hidden = r.keywords.length > 0;
  });
}

form.querySelector('[data-clear]').addEventListener('click', () => {
  textarea.value = '';
  form.dispatchEvent(new Event('input'));
  render();
  textarea.focus();
});
textarea.addEventListener('input', render);
hideCommon.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
