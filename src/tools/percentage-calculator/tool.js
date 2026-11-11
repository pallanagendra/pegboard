import { percentOf, whatPercent, percentChange, changeBy, wholeFromPart } from './logic.js';
import { parseNumber } from '../../assets/js/number-core.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
persistForm(form, 'percentage');

function show(n, result) {
  const box = form.querySelector(`[data-answer="${n}"]`);
  const value = box.querySelector('.answer__value');
  const formula = box.querySelector('.answer__formula');
  const copy = box.querySelector('[data-copy-from]');
  const bad = !!result.error;
  box.classList.toggle('answer--error', bad);
  value.textContent = bad ? result.error : result.text;
  formula.textContent = bad ? '' : result.formula;
  formula.hidden = bad;
  copy.hidden = bad;
}

function render() {
  const o = readForm(form);
  const n = (k) => parseNumber(o[k]);
  show(1, percentOf(n('p1'), n('x1')));
  show(2, whatPercent(n('a2'), n('b2')));
  show(3, percentChange(n('a3'), n('b3')));
  show(4, changeBy(n('x4'), n('p4'), o.d4));
  show(5, wholeFromPart(n('x5'), n('p5')));
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
