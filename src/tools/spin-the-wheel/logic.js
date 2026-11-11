import { randomBelow, randomUint32 } from '../../assets/js/random-core.js';

export const MAX_ENTRIES = 200;

/** One entry per line; blank lines are skipped and spaces trimmed. */
export function parseEntries(text) {
  const all = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return { entries: all.slice(0, MAX_ENTRIES), truncated: all.length > MAX_ENTRIES };
}

const norm = (deg) => ((deg % 360) + 360) % 360;

/**
 * Which entry sits under the pointer at the top of the wheel.
 * The wheel turns clockwise by `rotation` degrees; slice i covers i·(360/n) to (i+1)·(360/n), clockwise from the top.
 */
export function indexAtRotation(rotation, n) {
  const a = norm(-rotation);
  return Math.min(n - 1, Math.floor(a / (360 / n)));
}

/**
 * Rotation that brings slice `index` under the pointer after `turns` full turns from `current`.
 * `jitter` (0–1) picks the landing spot inside the slice, kept clear of the edges.
 */
export function targetRotation(current, index, n, { turns = 6, jitter = 0.5 } = {}) {
  const seg = 360 / n;
  const landing = (index + 0.12 + 0.76 * jitter) * seg;
  return current + turns * 360 + norm(-landing - current);
}

/** Pick the winner first (fairly), then work out where the wheel should stop. */
export function planSpin(current, n, next = randomUint32) {
  const index = randomBelow(n, next);
  const jitter = randomBelow(1000, next) / 1000;
  const turns = 5 + randomBelow(3, next); // 5–7 turns so spins don't all look alike
  return { index, rotation: targetRotation(current, index, n, { turns, jitter }) };
}

/** Remove one entry (the first match) from the text, keeping everything else as typed. */
export function removeEntry(text, entry) {
  const lines = String(text || '').split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === entry);
  if (i >= 0) lines.splice(i, 1);
  return lines.join('\n');
}

/** SVG path for a slice from angle a to b (degrees clockwise from the top) on a circle of radius r. */
export function slicePath(a, b, r = 100) {
  if (b - a >= 360) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
  const pt = (deg) => {
    const t = (deg * Math.PI) / 180;
    return `${(r * Math.sin(t)).toFixed(3)} ${(-r * Math.cos(t)).toFixed(3)}`;
  };
  return `M0 0L${pt(a)}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${pt(b)}Z`;
}

/** Color index for each slice so neighbors never match, including the last and the first. */
export function sliceColors(n, paletteSize) {
  const out = Array.from({ length: n }, (_, i) => i % paletteSize);
  if (n > 1 && out[n - 1] === out[0]) out[n - 1] = (out[n - 2] + 1) % paletteSize === out[0] ? (out[0] + 2) % paletteSize : (out[n - 2] + 1) % paletteSize;
  return out;
}
