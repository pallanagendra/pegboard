// Fair randomness for the Everyday tools. Uses the browser's cryptographic generator
// (crypto.getRandomValues) and rejection sampling, so every outcome is exactly as likely
// as every other — no modulo bias. Every function takes an optional `next` source that
// returns a uniform 32-bit unsigned integer, so tests can pass a fixed sequence.

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

/** One uniform 32-bit unsigned integer from the browser's secure generator. */
export function randomUint32() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

/** A uniform integer in [0, n), for any whole n from 1 to 2^53. */
export function randomBelow(n, next = randomUint32) {
  if (!Number.isInteger(n) || n < 1 || n > TWO_53) throw new RangeError('n must be a whole number from 1 to 2^53');
  if (n === 1) return 0;
  if (n <= TWO_32) {
    const limit = TWO_32 - (TWO_32 % n); // largest multiple of n that fits; anything above is thrown away
    let x;
    do x = next(); while (x >= limit);
    return x % n;
  }
  const limit = TWO_53 - (TWO_53 % n);
  let x;
  do x = (next() & 0x1fffff) * TWO_32 + next(); while (x >= limit); // 21 + 32 = 53 random bits
  return x % n;
}

/** A uniform whole number from min to max, both included. */
export function randomInt(min, max, next = randomUint32) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) throw new RangeError('min and max must be whole numbers');
  if (max < min) throw new RangeError('max is below min');
  return min + randomBelow(max - min + 1, next);
}

/** Shuffle a copy of the array (Fisher–Yates). */
export function shuffle(items, next = randomUint32) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, next);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `count` different whole numbers from min to max, in the order they were drawn. */
export function sampleUnique(min, max, count, next = randomUint32) {
  const size = max - min + 1;
  if (count > size) throw new RangeError('Not enough numbers in the range');
  if (size <= 100000 || count * 2 > size) {
    // partial Fisher–Yates over a lazy array: only touched slots are stored
    const swapped = new Map();
    const at = (i) => (swapped.has(i) ? swapped.get(i) : min + i);
    const out = [];
    for (let i = 0; i < count; i++) {
      const j = i + randomBelow(size - i, next);
      const vi = at(i);
      const vj = at(j);
      swapped.set(j, vi);
      out.push(vj);
    }
    return out;
  }
  const seen = new Set();
  const out = [];
  while (out.length < count) {
    const v = randomInt(min, max, next);
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** A source that replays fixed values, for tests: sequence(0, 5, 7) → 0, 5, 7, 0, 5, … */
export function sequence(...values) {
  let i = 0;
  return () => values[i++ % values.length] >>> 0;
}

/** True when the visitor asked the system for less motion. */
export function prefersLessMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
