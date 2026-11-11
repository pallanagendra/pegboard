// Stopwatch and countdown timer as plain state + pure functions.
// Times are wall-clock milliseconds (Date.now), so a saved state still adds up after a refresh.

const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------------- stopwatch
export const SW_EMPTY = Object.freeze({ running: false, startedAt: null, elapsed: 0, laps: [] });

export function swElapsed(sw, now) {
  return sw.elapsed + (sw.running ? Math.max(0, now - sw.startedAt) : 0);
}
export function swStart(sw, now) {
  return sw.running ? sw : { ...sw, running: true, startedAt: now };
}
export function swStop(sw, now) {
  return sw.running ? { ...sw, running: false, startedAt: null, elapsed: swElapsed(sw, now) } : sw;
}
export function swLap(sw, now) {
  const total = swElapsed(sw, now);
  const prev = sw.laps.length ? sw.laps[sw.laps.length - 1].total : 0;
  return { ...sw, laps: [...sw.laps, { total, split: total - prev }] };
}

/** Index of the fastest and slowest lap, once there are at least two. */
export function lapExtremes(laps) {
  if (laps.length < 2) return { fastest: -1, slowest: -1 };
  let fastest = 0;
  let slowest = 0;
  laps.forEach((l, i) => {
    if (l.split < laps[fastest].split) fastest = i;
    if (l.split > laps[slowest].split) slowest = i;
  });
  return { fastest, slowest };
}

/** Stopwatch reading split into the big part and the hundredths: { main: "1:02:03", fraction: ".45" }. */
export function stopwatchParts(ms) {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const main = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { main, fraction: `.${pad(cs % 100)}` };
}
export function formatStopwatch(ms) {
  const p = stopwatchParts(ms);
  return p.main + p.fraction;
}

/** Laps as tab-separated text that pastes cleanly into a spreadsheet. */
export function lapsToText(laps) {
  return ['Lap\tLap time\tTotal', ...laps.map((l, i) => `${i + 1}\t${formatStopwatch(l.split)}\t${formatStopwatch(l.total)}`)].join('\n');
}

// ---------------- countdown timer
export const MAX_TIMER = 100 * 3600 * 1000 - 1000; // 99:59:59

export const TIMER_EMPTY = Object.freeze({ duration: 5 * 60000, remaining: 5 * 60000, running: false, endsAt: null });

/** Hours, minutes and seconds boxes → milliseconds, or NaN when nothing usable was entered. */
export function durationFromParts(h, m, s) {
  const vals = [h, m, s].map((v) => (v === '' || v == null ? 0 : Number(v)));
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return NaN;
  const ms = Math.round(((vals[0] * 60 + vals[1]) * 60 + vals[2]) * 1000);
  return Math.min(ms, MAX_TIMER);
}

/** Milliseconds → { h, m, s } for filling the boxes back in. */
export function partsFromDuration(ms) {
  const total = Math.round(ms / 1000);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function timerRemaining(t, now) {
  return t.running ? Math.max(0, t.endsAt - now) : t.remaining;
}
export function timerSet(t, duration) {
  return { duration, remaining: duration, running: false, endsAt: null };
}
export function timerStart(t, now) {
  if (t.running || t.remaining <= 0) return t;
  return { ...t, running: true, endsAt: now + t.remaining };
}
export function timerPause(t, now) {
  return t.running ? { ...t, running: false, endsAt: null, remaining: timerRemaining(t, now) } : t;
}
export function timerReset(t) {
  return { ...t, running: false, endsAt: null, remaining: t.duration };
}
/** Add time to a running or paused timer (also restarts a finished one with the extra time). */
export function timerAdd(t, ms, now) {
  const remaining = Math.min(MAX_TIMER, timerRemaining(t, now) + ms);
  const duration = Math.min(MAX_TIMER, Math.max(t.duration, remaining));
  return t.running ? { ...t, duration, endsAt: now + remaining } : { ...t, duration, remaining };
}
export function timerDone(t, now) {
  return t.running && now >= t.endsAt;
}

/** Countdown text, rounded up so it reads 0:01 until the last second is over: "4:59", "1:00:00". */
export function formatTimer(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Short spoken-style length: "5 minutes", "1 hour 30 minutes", "45 seconds". */
export function describeDuration(ms) {
  const { h, m, s } = partsFromDuration(ms);
  const bits = [];
  if (h) bits.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) bits.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s || !bits.length) bits.push(`${s} second${s === 1 ? '' : 's'}`);
  return bits.join(' ');
}
