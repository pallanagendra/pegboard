// Adding up durations and working with clock times. Everything is whole seconds. Pure functions, unit tested.

const num = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** { sign: '+'|'-', h, m, s } rows → total seconds (fractions allowed, e.g. 1.5 hours). */
export function sumDurations(rows) {
  return Math.round(
    rows.reduce((total, r) => total + (r.sign === '-' ? -1 : 1) * (num(r.h) * 3600 + num(r.m) * 60 + num(r.s)), 0),
  );
}

/** 27000 → "7 h 30 min", -90 → "−1 min 30 s" */
export function formatDuration(totalSeconds) {
  const sign = totalSeconds < 0 ? '−' : '';
  let s = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [];
  if (h) parts.push(`${h.toLocaleString()} h`);
  if (m) parts.push(`${m} min`);
  if (s || !parts.length) parts.push(`${s} s`);
  return sign + parts.join(' ');
}

/** 27000 → "7:30:00" */
export function formatClockDuration(totalSeconds) {
  const sign = totalSeconds < 0 ? '−' : '';
  let s = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Seconds → decimal hours, e.g. 27900 → 7.75 */
export function decimalHours(totalSeconds, decimals = 2) {
  return Math.round((totalSeconds / 3600) * 10 ** decimals) / 10 ** decimals;
}

/** "09:30" → minutes after midnight, or NaN. */
export function parseClock(s) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || '').trim());
  if (!m) return NaN;
  const [h, min, sec] = [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
  if (h > 23 || min > 59 || sec > 59) return NaN;
  return h * 3600 + min * 60 + sec;
}

/**
 * Time from start to end (seconds after midnight). If end is earlier, it's taken as the next day.
 * breakMinutes is subtracted. Returns { seconds, overnight }.
 */
export function timeBetween(start, end, breakMinutes = 0) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { error: 'Enter both times.' };
  const overnight = end < start;
  const span = (overnight ? end + 86400 : end) - start;
  const seconds = span - Math.round(num(breakMinutes) * 60);
  if (seconds < 0) return { error: 'The break is longer than the time between them.' };
  return { seconds, overnight };
}

/** Add seconds to a clock time. Returns { seconds (0–86399), dayOffset }. */
export function addToClock(clockSeconds, deltaSeconds) {
  const total = clockSeconds + deltaSeconds;
  const dayOffset = Math.floor(total / 86400);
  return { seconds: ((total % 86400) + 86400) % 86400, dayOffset };
}

/** Clock seconds → "6:15 PM" / "18:15" in the visitor's language. */
export function formatClock(seconds, locale) {
  const d = new Date(Date.UTC(2000, 0, 1, 0, 0, seconds));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', ...(seconds % 60 ? { second: '2-digit' } : {}), timeZone: 'UTC' }).format(d);
}
