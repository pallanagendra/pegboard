// Color parsing, conversion and WCAG contrast. Colors are { r, g, b } in 0–255 plus a for alpha (0–1).

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 0) => Number(n.toFixed(d));

function num(part, scale) {
  const p = String(part).trim();
  if (p.endsWith('%')) return (parseFloat(p) / 100) * scale;
  return parseFloat(p);
}

function hueDegrees(part) {
  const p = String(part).trim().toLowerCase();
  const v = parseFloat(p);
  if (p.endsWith('turn')) return v * 360;
  if (p.endsWith('rad')) return (v * 180) / Math.PI;
  if (p.endsWith('grad')) return v * 0.9;
  return v;
}

/** Read a color: #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla(), or three numbers like "255, 200, 61". Null if it can't. */
export function parseColor(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? round(n(6) / 255, 3) : 1 };
  }
  m = s.match(/^rgba?\((.*)\)$/) || s.match(/^(\d{1,3}\s*[,\s]\s*\d{1,3}\s*[,\s]\s*\d{1,3})$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const [r, g, b] = parts.slice(0, 3).map((p) => num(p, 255));
    const a = parts[3] === undefined ? 1 : num(parts[3], 1);
    if ([r, g, b, a].some((v) => !Number.isFinite(v))) return null;
    return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a: clamp(a, 0, 1) };
  }
  m = s.match(/^hsla?\((.*)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const h = hueDegrees(parts[0]);
    const sat = parseFloat(parts[1]) / 100;
    const light = parseFloat(parts[2]) / 100;
    const a = parts[3] === undefined ? 1 : num(parts[3], 1);
    if ([h, sat, light, a].some((v) => !Number.isFinite(v))) return null;
    return { ...hslToRgb(h, clamp(sat, 0, 1), clamp(light, 0, 1)), a: clamp(a, 0, 1) };
  }
  return null;
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function rgbToHsl({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function rgbToHsv({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  const h = d ? rgbToHsl({ r, g, b }).h : 0;
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
}

export function rgbToCmyk({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: ((1 - R - k) / (1 - k)) * 100, m: ((1 - G - k) / (1 - k)) * 100, y: ((1 - B - k) / (1 - k)) * 100, k: k * 100 };
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** OKLCH, the perceptual color space modern CSS uses: lightness 0–1, chroma, hue in degrees. */
export function rgbToOklch({ r, g, b }) {
  const [R, G, B] = [r, g, b].map(linear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, Bb);
  const H = C < 1e-4 ? 0 : ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c: C, h: H };
}

const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');
const alphaText = (a) => String(round(a, 2));

/** Every format at once, as strings ready to paste into CSS or a design tool. */
export function formats(col) {
  const a = col.a ?? 1;
  const hsl = rgbToHsl(col);
  const hsv = rgbToHsv(col);
  const cmyk = rgbToCmyk(col);
  const ok = rgbToOklch(col);
  const p = (n) => `${Math.round(n)}%`;
  return {
    hex: `#${hex2(col.r)}${hex2(col.g)}${hex2(col.b)}${a < 1 ? hex2(a * 255) : ''}`,
    rgb: a < 1 ? `rgba(${col.r}, ${col.g}, ${col.b}, ${alphaText(a)})` : `rgb(${col.r}, ${col.g}, ${col.b})`,
    hsl: a < 1 ? `hsla(${Math.round(hsl.h)}, ${p(hsl.s)}, ${p(hsl.l)}, ${alphaText(a)})` : `hsl(${Math.round(hsl.h)}, ${p(hsl.s)}, ${p(hsl.l)})`,
    hsv: `hsv(${Math.round(hsv.h)}, ${p(hsv.s)}, ${p(hsv.v)})`,
    cmyk: `cmyk(${p(cmyk.c)}, ${p(cmyk.m)}, ${p(cmyk.y)}, ${p(cmyk.k)})`,
    oklch: `oklch(${(ok.l * 100).toFixed(1)}% ${ok.c.toFixed(3)} ${ok.h.toFixed(1)}${a < 1 ? ` / ${alphaText(a)}` : ''})`,
  };
}

export const toHex = (col) => `#${hex2(col.r)}${hex2(col.g)}${hex2(col.b)}`;

/** WCAG 2 relative luminance. */
export function luminance(col) {
  return 0.2126 * linear(col.r) + 0.7152 * linear(col.g) + 0.0722 * linear(col.b);
}

/** Contrast ratio from 1 (none) to 21 (black on white). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 levels this ratio meets. */
export function wcag(ratio) {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    ui: ratio >= 3,
  };
}

/** Ratios are rounded down to 2 decimals, so 4.499 never shows as a passing 4.50. */
export function formatRatio(ratio) {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/** Text color that stands out more on this background: black or white. */
export function readableOn(bg) {
  return contrast(bg, { r: 0, g: 0, b: 0 }) >= contrast(bg, { r: 255, g: 255, b: 255 }) ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

export function mix(a, b, t) {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t), a: 1 };
}

/** Four tints, the color itself and four shades, lightest first. */
export function tintsAndShades(col) {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const base = { ...col, a: 1 };
  return [0.8, 0.6, 0.4, 0.2].map((t) => mix(base, white, t)).concat([base], [0.2, 0.4, 0.6, 0.8].map((t) => mix(base, black, t)));
}

/**
 * The closest color to `fg` (same hue and saturation, lightness moved) that reaches `target` contrast on `bg`.
 * Returns null if neither lighter nor darker gets there.
 */
export function nearestPassing(fg, bg, target = 4.5) {
  if (contrast(fg, bg) >= target) return { ...fg };
  const { h, s, l } = rgbToHsl(fg);
  let best = null;
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 100; step++) {
      const L = l + dir * step;
      if (L < 0 || L > 100) break;
      const c = { ...hslToRgb(h, s / 100, L / 100), a: 1 };
      if (contrast(c, bg) >= target) {
        if (!best || step < best.step) best = { step, color: c };
        break;
      }
    }
  }
  return best ? best.color : null;
}
