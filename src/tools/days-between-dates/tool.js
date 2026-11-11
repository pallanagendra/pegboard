import { between, shiftDate } from './logic.js';
import { todayISO, formatDate, formatYMD, plural } from '../../assets/js/date-core.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const stats = form.querySelector('[data-stats]');

// sensible starting point: today, and the coming New Year's Day
const today = todayISO();
form.start.value = today;
form.end.value = `${Number(today.slice(0, 4)) + 1}-01-01`;
form.from.value = today;
persistForm(form, 'days');

const stat = (value, label) => `<div class="stat"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;

function show(key, text, formula, error = false) {
  const box = form.querySelector(`[data-answer="${key}"]`);
  box.classList.toggle('answer--error', error);
  box.querySelector('.answer__value').textContent = text;
  const f = box.querySelector('.answer__formula');
  f.textContent = formula || '';
  f.hidden = !formula;
  box.querySelector('[data-copy-from]').hidden = error;
}

function render() {
  const o = readForm(form);

  const r = between(o.start, o.end, o.includeEnd);
  if (r.error) {
    show('between', r.error, '', true);
    stats.innerHTML = '';
  } else {
    const from = formatDate(r.reversed ? r.end : r.start, { dateStyle: 'medium' });
    const to = formatDate(r.reversed ? r.start : r.end, { dateStyle: 'medium' });
    show('between', plural(r.days, 'day'), `${from} to ${to}${o.includeEnd ? ', counting both days' : ''}${r.reversed ? '. The end date is before the start date' : ''}`);
    stats.innerHTML = [
      stat(r.business.toLocaleString(), 'Business days (Mon–Fri)'),
      stat(r.weekend.toLocaleString(), 'Weekend days'),
      stat(r.weeks ? `${plural(r.weeks, 'week')}${r.weekDays ? `, ${plural(r.weekDays, 'day')}` : ''}` : plural(r.weekDays, 'day'), 'In weeks'),
      stat(formatYMD(r.ymd), 'In years, months and days'),
    ].join('');
  }

  const amount = (o.op === '-' ? -1 : 1) * Math.abs(Number(o.amount) || 0);
  const s = shiftDate(o.from, amount, o.unit);
  if (s.error) {
    show('shift', s.error, '', true);
  } else {
    const unitWord = { days: 'day', business: 'business day', weeks: 'week', months: 'month', years: 'year' }[o.unit];
    const what = `${plural(Math.abs(amount), unitWord)} ${amount < 0 ? 'before' : 'after'} ${formatDate(s.start, { dateStyle: 'medium' })}`;
    const span = o.unit === 'days' ? '' : `, ${plural(Math.abs(s.calendarDays), 'calendar day')}`;
    show('shift', formatDate(s.date, { dateStyle: 'full' }), `${what}${span}`);
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
