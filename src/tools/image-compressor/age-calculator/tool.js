import { computeAge } from './logic.js';
import { todayISO, formatDate, formatYMD, plural } from '../../assets/js/date-core.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const heroBox = document.querySelector('[data-hero]');
const hero = document.querySelector('#ag-age');
const heroNote = document.querySelector('[data-hero-note]');
const stats = document.querySelector('[data-stats]');

form.on.value = todayISO();
persistForm(form, 'age');

const ordinal = (n) => `${n}${{ one: 'st', two: 'nd', few: 'rd', other: 'th' }[new Intl.PluralRules('en-US', { type: 'ordinal' }).select(n)]}`;
const stat = (value, label, key = false) => `<div class="stat${key ? ' stat--key' : ''}"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`;

function render() {
  const o = readForm(form);
  const r = computeAge(o.birth, o.on || todayISO());
  if (r.error) {
    heroBox.classList.add('answer--error');
    hero.textContent = r.error;
    heroNote.textContent = '';
    stats.innerHTML = '';
    return;
  }
  heroBox.classList.remove('answer--error');
  hero.textContent = formatYMD(r);
  const isToday = (o.on || todayISO()) === todayISO();
  heroNote.textContent = `${isToday ? 'Today' : `On ${formatDate(r.on, { dateStyle: 'long' })}`}${r.birthdayToday && r.years ? `. Happy ${ordinal(r.years)} birthday!` : ''}`;

  const nextLabel = r.next.days === 0 ? 'Birthday' : `Next birthday, turning ${r.next.turning}`;
  const nextValue = r.next.days === 0 ? 'Today' : `In ${plural(r.next.days, 'day')}`;
  stats.innerHTML = [
    stat(nextValue, `${nextLabel}, ${formatDate(r.next.date, { weekday: 'long', month: 'long', day: 'numeric' })}`, true),
    stat(r.totalMonths.toLocaleString(), 'Total months'),
    stat(r.totalWeeks.toLocaleString(), `Total weeks${r.weekRemainder ? ` and ${plural(r.weekRemainder, 'day')}` : ''}`),
    stat(r.totalDays.toLocaleString(), 'Total days'),
    stat(formatDate(r.birth, { weekday: 'long' }), `Day of the week born, ${formatDate(r.birth, { dateStyle: 'long' })}`),
  ].join('');
}

document.querySelector('[data-today]').addEventListener('click', () => {
  form.on.value = todayISO();
  form.on.dispatchEvent(new Event('input', { bubbles: true }));
});
form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
