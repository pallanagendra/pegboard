// Calendar-date math. Every date is a UTC midnight, so daylight-saving changes and time zones
// can never shift a day. Pure functions, unit tested.

const DAY = 86400000;

/** "2026-11-10" → Date at UTC midnight, or null if it isn't a real date. */
export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/** Today's date where the visitor is, as "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(date, n) {
  return new Date(date.getTime() + n * DAY);
}

/** Add months, clamping to the month's last day: 31 January + 1 month = 28 or 29 February. */
export function addMonths(date, n) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/** Whole days from a to b (negative if b is earlier). */
export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** Calendar difference from a to b (a must not be after b): { years, months, days }. */
export function diffYMD(a, b) {
  if (b < a) throw new RangeError('The second date is earlier than the first.');
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (addMonths(a, months) > b) months--;
  const anchor = addMonths(a, months);
  return { years: Math.floor(months / 12), months: months % 12, days: daysBetween(anchor, b) };
}

export function isWeekend(date) {
  const d = date.getUTCDay();
  return d === 0 || d === 6;
}

/**
 * Weekdays (Monday–Friday) from a up to b. Counts a; counts b only when includeEnd is true.
 * Order doesn't matter; the result is always positive.
 */
export function businessDaysBetween(a, b, includeEnd = false) {
  let [start, end] = a <= b ? [a, b] : [b, a];
  if (includeEnd) end = addDays(end, 1);
  const total = daysBetween(start, end);
  const weeks = Math.floor(total / 7);
  let count = weeks * 5;
  let day = addDays(start, weeks * 7);
  while (day < end) {
    if (!isWeekend(day)) count++;
    day = addDays(day, 1);
  }
  return count;
}

/** Move n weekdays forward (or back, if n is negative), skipping Saturdays and Sundays. */
export function addBusinessDays(date, n) {
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  let day = date;
  while (left > 0) {
    day = addDays(day, step);
    if (!isWeekend(day)) left--;
  }
  return day;
}

/** Format a UTC date in the visitor's language. */
export function formatDate(date, options = { dateStyle: 'full' }, locale) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
}

/** "1 year", "3 days" */
export function plural(n, word) {
  return `${n.toLocaleString()} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
}

/** { years, months, days } → "34 years, 2 months, 5 days" (zero parts left out, except all-zero). */
export function formatYMD({ years, months, days }) {
  const parts = [];
  if (years) parts.push(plural(years, 'year'));
  if (months) parts.push(plural(months, 'month'));
  if (days || !parts.length) parts.push(plural(days, 'day'));
  return parts.join(', ');
}
