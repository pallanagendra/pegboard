import { randomInt, sampleUnique } from '../../assets/js/random-core.js';

export const MAX_COUNT = 10000;
const MAX_DECIMALS = 4;

/**
 * Draw random numbers.
 * Returns { numbers, values, low, high, swapped } — `numbers` are the formatted strings —
 * or { error } with a sentence explaining what to change.
 */
export function generate({ min, max, count = 1, unique = false, sort = false, decimals = 0 }, next) {
  if (min === '' || max === '' || min == null || max == null) return { error: 'Enter a lowest and a highest number.' };
  if (count === '' || count == null) count = 1;
  min = Number(min);
  max = Number(max);
  count = Number(count);
  decimals = Math.min(MAX_DECIMALS, Math.max(0, Math.trunc(Number(decimals) || 0)));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { error: 'Enter a lowest and a highest number.' };
  if (!Number.isInteger(count) || count < 1) return { error: 'How many should be a whole number, 1 or more.' };
  if (count > MAX_COUNT) return { error: `You can draw up to ${MAX_COUNT.toLocaleString('en-US')} numbers at a time.` };

  let swapped = false;
  if (min > max) {
    [min, max] = [max, min];
    swapped = true;
  }
  const scale = 10 ** decimals;
  // work in whole steps of 1/scale so every value with that many decimals is equally likely
  const lo = Math.ceil(min * scale - 1e-9);
  const hi = Math.floor(max * scale + 1e-9);
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi - lo + 1 > 2 ** 53) return { error: 'That range is too large. Try smaller numbers or fewer decimal places.' };
  if (lo > hi) return { error: `There’s no number with ${decimals} decimal place${decimals === 1 ? '' : 's'} between ${min} and ${max}.` };

  const size = hi - lo + 1;
  if (unique && count > size) {
    return { error: `There are only ${size.toLocaleString('en-US')} different numbers in that range, so ${count.toLocaleString('en-US')} can’t all be different. Draw fewer, widen the range or allow repeats.` };
  }

  const steps = unique ? sampleUnique(lo, hi, count, next) : Array.from({ length: count }, () => randomInt(lo, hi, next));
  if (sort) steps.sort((a, b) => a - b);
  const values = steps.map((s) => s / scale);
  return { values, numbers: values.map((v) => formatValue(v, decimals)), low: lo / scale, high: hi / scale, swapped, size };
}

/** Fixed decimals, no thousands separators (so a copied list stays easy to paste anywhere). */
export function formatValue(v, decimals = 0) {
  const s = v.toFixed(decimals);
  return s === '-0' || /^-0\.0+$/.test(s) ? s.slice(1) : s;
}

/** One line describing the draw, e.g. "6 numbers from 1 to 49, no repeats, sorted". */
export function describe({ count, unique, sort, decimals }, low, high) {
  const parts = [`${Number(count) === 1 ? 'A number' : `${Number(count).toLocaleString('en-US')} numbers`} from ${formatValue(low, decimals)} to ${formatValue(high, decimals)}`];
  if (Number(count) > 1) parts.push(unique ? 'no repeats' : 'repeats allowed');
  if (sort && Number(count) > 1) parts.push('sorted');
  if (Number(decimals) > 0) parts.push(`${decimals} decimal place${Number(decimals) === 1 ? '' : 's'}`);
  return parts.join(', ');
}
