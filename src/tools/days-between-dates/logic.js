// Counting days between dates, and moving a date forward or back. Pure functions, unit tested.
import { parseISODate, addDays, addMonths, addBusinessDays, daysBetween, businessDaysBetween, diffYMD } from '../../assets/js/date-core.js';

/** Days from start to end. includeEnd adds the end date itself (e.g. a hotel stay vs. a project that runs through the last day). */
export function between(startISO, endISO, includeEnd = false) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end) return { error: 'Enter both dates.' };
  const reversed = end < start;
  const [a, b] = reversed ? [end, start] : [start, end];
  const days = daysBetween(a, b) + (includeEnd ? 1 : 0);
  const ymd = diffYMD(a, includeEnd ? addDays(b, 1) : b);
  const business = businessDaysBetween(a, b, includeEnd);
  return { start, end, reversed, days, weeks: Math.floor(days / 7), weekDays: days % 7, ymd, business, weekend: days - business };
}

/** Move a date by an amount. unit: days | weeks | months | years | business */
export function shiftDate(startISO, amount, unit = 'days') {
  const start = parseISODate(startISO);
  if (!start) return { error: 'Enter a start date.' };
  const n = Math.trunc(Number(amount));
  if (!Number.isFinite(n)) return { error: 'Enter how many to add or subtract.' };
  let date;
  switch (unit) {
    case 'weeks':
      date = addDays(start, n * 7);
      break;
    case 'months':
      date = addMonths(start, n);
      break;
    case 'years':
      date = addMonths(start, n * 12);
      break;
    case 'business':
      date = addBusinessDays(start, n);
      break;
    default:
      date = addDays(start, n);
  }
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return { error: 'That lands outside the years 1 to 9999.' };
  return { start, date, calendarDays: daysBetween(start, date) };
}
