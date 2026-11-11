import { amortize, byYear, toCSV } from './logic.js';
import { parseNumber, formatMoney } from '../../assets/js/number-core.js';
import { readForm, persistForm, downloadBlob } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const heroBox = document.querySelector('[data-hero]');
const hero = document.querySelector('#ln-payment');
const heroNote = document.querySelector('[data-hero-note]');
const stats = document.querySelector('[data-stats]');
const extraNote = document.querySelector('[data-extra-note]');
const head = document.querySelector('[data-head]');
const body = document.querySelector('[data-rows]');
const schedule = document.querySelector('[data-schedule]');
const views = [...document.querySelectorAll('input[name="view"]')];

// default first payment: next month
if (!form.start.value) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  form.start.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}
persistForm(form, 'loan');

const monthName = (year, month, style = 'short') => new Intl.DateTimeFormat(undefined, { month: style, year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
const stat = (value, label, key = false) => `<div class="stat${key ? ' stat--key' : ''}"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const duration = (months) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && plural(y, 'year'), m && plural(m, 'month')].filter(Boolean).join(' ') || '0 months';
};

let current = null;

function render() {
  const o = readForm(form);
  const money = (n) => formatMoney(n, o.currency);
  const [sy, sm] = String(o.start || '').split('-').map(Number);
  const months = (Number(o.years) || 0) * 12 + (Number(o.months) || 0);
  let plan;
  let base;
  try {
    const input = { principal: parseNumber(o.amount), ratePct: parseNumber(o.rate), months, start: sy && sm ? { year: sy, month: sm } : undefined };
    if (!Number.isFinite(input.ratePct)) throw new RangeError('Enter an interest rate, such as 6.5.');
    base = amortize(input);
    const extra = parseNumber(o.extra);
    plan = extra > 0 ? amortize({ ...input, extra }) : base;
  } catch (err) {
    current = null;
    heroBox.classList.add('answer--error');
    hero.textContent = err.message;
    heroNote.textContent = '';
    stats.innerHTML = '';
    extraNote.hidden = true;
    schedule.hidden = true;
    return;
  }

  current = plan;
  heroBox.classList.remove('answer--error');
  hero.textContent = `${money(plan.payment)} a month`;
  heroNote.textContent = `${plural(months, 'payment')} over ${duration(months)}`;
  const last = plan.rows.at(-1);
  stats.innerHTML = [
    stat(money(plan.totalInterest), 'Total interest', true),
    stat(money(plan.totalPaid), 'Total paid'),
    stat(monthName(last.year, last.month), 'Paid off'),
    stat(plan.months.toLocaleString(), 'Payments'),
  ].join('');

  if (plan !== base) {
    const savedInterest = base.totalInterest - plan.totalInterest;
    const savedMonths = base.months - plan.months;
    extraNote.textContent = `Paying ${money(parseNumber(o.extra))} extra each month saves ${money(savedInterest)} in interest and pays the loan off ${duration(savedMonths)} sooner.`;
    extraNote.hidden = false;
  } else {
    extraNote.hidden = true;
  }

  schedule.hidden = false;
  renderTable(money);
}

function renderTable(money) {
  if (!current) return;
  const byMonth = views.find((v) => v.checked)?.value === 'month';
  const hasExtra = current.rows.some((r) => r.extra > 0);
  const cols = byMonth ? ['Month', 'Payment', 'Principal', 'Interest', ...(hasExtra ? ['Extra'] : []), 'Balance'] : ['Year', 'Paid', 'Principal', 'Interest', ...(hasExtra ? ['Extra'] : []), 'Balance at year end'];
  head.innerHTML = `<tr>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr>`;
  const rows = byMonth
    ? current.rows.map((r) => [monthName(r.year, r.month), money(r.payment), money(r.principal), money(r.interest), ...(hasExtra ? [money(r.extra)] : []), money(r.balance)])
    : byYear(current.rows).map((y) => [String(y.year), money(y.paid), money(y.principal), money(y.interest), ...(hasExtra ? [money(y.extra)] : []), money(y.balance)]);
  body.innerHTML = rows.map((cells) => `<tr>${cells.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('');
}

views.forEach((v) => v.addEventListener('change', () => renderTable((n) => formatMoney(n, readForm(form).currency))));
document.querySelector('[data-csv]').addEventListener('click', () => {
  if (!current) return;
  downloadBlob(new Blob([toCSV(current.rows)], { type: 'text/csv;charset=utf-8' }), 'loan-schedule.csv');
});

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
