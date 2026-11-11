// Exact age and next birthday. Someone born on 29 February has their birthday on 28 February
// in other years. Pure functions, unit tested.
import { parseISODate, addMonths, daysBetween, diffYMD } from '../../assets/js/date-core.js';

export function computeAge(birthISO, onISO) {
  const birth = parseISODate(birthISO);
  const on = parseISODate(onISO);
  if (!birth) return { error: 'Enter a date of birth.' };
  if (!on) return { error: 'Enter the date to calculate the age on.' };
  if (birth > on) return { error: 'The date of birth is after the date you’re calculating for.' };

  const ymd = diffYMD(birth, on);
  const totalDays = daysBetween(birth, on);
  const totalMonths = ymd.years * 12 + ymd.months;
  const birthdayToday = ymd.months === 0 && ymd.days === 0;
  const nextYears = birthdayToday ? ymd.years : ymd.years + 1;
  const nextDate = addMonths(birth, nextYears * 12);

  return {
    birth,
    on,
    ...ymd,
    totalMonths,
    totalWeeks: Math.floor(totalDays / 7),
    weekRemainder: totalDays % 7,
    totalDays,
    birthdayToday,
    next: { date: nextDate, days: daysBetween(on, nextDate), turning: nextYears },
  };
}
