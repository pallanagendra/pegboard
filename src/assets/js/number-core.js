// Reading and writing numbers the way people type them. Pure functions, unit tested.

/**
 * "1,234.5" → 1234.5, "12,5" → 12.5, "1 000" → 1000, "$20,000" → 20000, "-3" → -3.
 * A comma followed by exactly three digits is a thousands separator; otherwise it's a decimal point.
 * Returns NaN for empty or unreadable input.
 */
export function parseNumber(input) {
  let s = String(input ?? '').trim().replace(/[\s  $€£¥₹%]/g, '');
  if (!s) return NaN;
  if (s.includes('.')) s = s.replace(/,/g, '');
  else if (/^[-+]?0,/.test(s)) s = s.replace(',', '.'); // "0,125" can only be a decimal
  else if (/,\d{3}(?!\d)/.test(s) && !/,\d{1,2}$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** Up to `max` decimals, trailing zeros dropped, grouped for the visitor's language. */
export function formatNumber(n, max = 6, locale) {
  if (!Number.isFinite(n)) return '—';
  const clean = Math.abs(n) < 1e-12 ? 0 : n;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: max }).format(clean);
}

export function formatMoney(n, currency = 'USD', locale) {
  if (!Number.isFinite(n)) return '—';
  if (!currency) return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}
