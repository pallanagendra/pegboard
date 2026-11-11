import { makePassword, makePassphrase, strength, crackTime } from './logic.js';
import { readForm, persistForm, bindRangeOutputs } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const out = document.querySelector('[data-out]');
const meter = document.querySelector('[data-meter]');
const strengthEl = document.querySelector('[data-strength]');
const crackEl = document.querySelector('[data-crack]');
const copyBtn = document.querySelector('[data-copy-from="#pw-out"]');

bindRangeOutputs(form);
persistForm(form, 'password');

// the 7,776-word list only downloads when someone switches to passphrases
let wordList = null;
let loading = null;
function loadWords() {
  loading ||= import('./words.js').then((m) => { wordList = m.default; }).catch(() => { loading = null; });
  return loading;
}

function show(result) {
  const bad = !!result.error;
  out.textContent = bad ? result.error : result.password;
  out.classList.toggle('secret--error', bad);
  copyBtn.disabled = bad;
  if (bad) {
    meter.dataset.level = '';
    strengthEl.textContent = '';
    crackEl.textContent = '';
    return;
  }
  const s = strength(result.bits);
  meter.dataset.level = s.level;
  strengthEl.innerHTML = `<strong>${s.label}</strong> · about ${Math.round(result.bits)} bits of randomness`;
  crackEl.textContent = `Guessing it would take ${crackTime(result.bits).text} on average, even at 10 billion guesses a second.`;
}

async function generate() {
  const o = readForm(form);
  for (const box of form.querySelectorAll('[data-mode]')) box.hidden = box.dataset.mode !== o.mode;
  if (o.mode === 'words') {
    if (!wordList) {
      out.textContent = 'Loading words…';
      await loadWords();
      if (!wordList) return show({ error: 'The word list didn’t load. Check your connection and try again.' });
    }
    show(makePassphrase(wordList, o.words, { separator: o.separator, capitalize: o.capitalize, addNumber: o.addNumber }));
  } else {
    show(makePassword(o.length, o));
  }
}

form.addEventListener('input', generate);
form.addEventListener('change', generate);
form.addEventListener('submit', (e) => e.preventDefault());
document.querySelector('[data-again]').addEventListener('click', generate);
generate();
