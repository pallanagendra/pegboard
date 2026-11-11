// The five everyday percentage questions. Each returns { value, formula } or { error }.
import { formatNumber as fmt } from '../../assets/js/number-core.js';

const missing = (...nums) => nums.some((n) => !Number.isFinite(n));
const NEED = { error: 'Enter both numbers.' };

/** What is p% of x? */
export function percentOf(p, x, locale) {
  if (missing(p, x)) return NEED;
  const value = (p / 100) * x;
  return { value, text: fmt(value, 6, locale), formula: `${fmt(p, 6, locale)} ÷ 100 × ${fmt(x, 6, locale)} = ${fmt(value, 6, locale)}` };
}

/** a is what percent of b? */
export function whatPercent(a, b, locale) {
  if (missing(a, b)) return NEED;
  if (b === 0) return { error: 'The second number can’t be zero.' };
  const value = (a / b) * 100;
  return { value, text: `${fmt(value, 4, locale)}%`, formula: `${fmt(a, 6, locale)} ÷ ${fmt(b, 6, locale)} × 100 = ${fmt(value, 4, locale)}%` };
}

/** Percentage change from a to b. */
export function percentChange(a, b, locale) {
  if (missing(a, b)) return NEED;
  if (a === 0) return { error: 'There’s no percentage change from zero. Start from a number other than 0.' };
  const value = ((b - a) / Math.abs(a)) * 100;
  const word = value > 0 ? 'increase' : value < 0 ? 'decrease' : 'no change';
  const sign = value > 0 ? '+' : '';
  return {
    value,
    text: value === 0 ? '0%, no change' : `${sign}${fmt(value, 4, locale)}% ${word}`,
    formula: `(${fmt(b, 6, locale)} − ${fmt(a, 6, locale)}) ÷ ${fmt(Math.abs(a), 6, locale)} × 100 = ${sign}${fmt(value, 4, locale)}%`,
  };
}

/** x increased or decreased by p%. */
export function changeBy(x, p, direction = 'increase', locale) {
  if (missing(x, p)) return NEED;
  const factor = direction === 'decrease' ? 1 - p / 100 : 1 + p / 100;
  const value = x * factor;
  return { value, text: fmt(value, 6, locale), formula: `${fmt(x, 6, locale)} × ${fmt(factor, 6, locale)} = ${fmt(value, 6, locale)}` };
}

/** x is p% of what? (the original before a percentage was taken) */
export function wholeFromPart(x, p, locale) {
  if (missing(x, p)) return NEED;
  if (p === 0) return { error: 'The percentage can’t be zero.' };
  const value = x / (p / 100);
  return { value, text: fmt(value, 6, locale), formula: `${fmt(x, 6, locale)} ÷ ${fmt(p, 6, locale)} × 100 = ${fmt(value, 6, locale)}` };
}
