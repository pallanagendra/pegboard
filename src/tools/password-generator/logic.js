import { randomBelow, randomUint32 } from '../../assets/js/random-core.js';

export const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
// characters that are easy to misread: capital i, lower L, one, capital o, zero, lower o
export const LOOK_ALIKE = 'Il1O0o';
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

/** The character groups in use, after removing look-alikes if asked. */
export function characterSets({ upper = true, lower = true, digits = true, symbols = true, avoidLookAlike = false } = {}) {
  const chosen = Object.entries({ upper, lower, digits, symbols })
    .filter(([, on]) => on)
    .map(([k]) => (avoidLookAlike ? [...SETS[k]].filter((c) => !LOOK_ALIKE.includes(c)).join('') : SETS[k]));
  return chosen.filter(Boolean);
}

/**
 * A random password that uses at least one character from every chosen group.
 * Draws are uniform over all passwords that meet that rule (anything else is thrown away and redrawn).
 */
export function makePassword(length, options = {}, next = randomUint32) {
  length = Number(length);
  const sets = characterSets(options);
  if (!sets.length) return { error: 'Tick at least one kind of character.' };
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) return { error: `Choose a length from ${MIN_LENGTH} to ${MAX_LENGTH}.` };
  if (length < sets.length) return { error: 'The password is too short to include every kind of character you ticked.' };
  const pool = sets.join('');
  for (let attempt = 0; attempt < 1000; attempt++) {
    let pw = '';
    for (let i = 0; i < length; i++) pw += pool[randomBelow(pool.length, next)];
    if (sets.every((s) => [...pw].some((c) => s.includes(c)))) return { password: pw, bits: length * Math.log2(pool.length), poolSize: pool.length };
  }
  return { error: 'Could not make a password with those settings. Try a longer length.' };
}

/** Words picked at random from a list, joined by a separator. */
export function makePassphrase(words, count, { separator = '-', capitalize = false, addNumber = false } = {}, next = randomUint32) {
  count = Number(count);
  if (!Array.isArray(words) || words.length < 2) return { error: 'The word list is not loaded yet.' };
  if (!Number.isInteger(count) || count < 3 || count > 12) return { error: 'Choose from 3 to 12 words.' };
  const picked = Array.from({ length: count }, () => {
    const w = words[randomBelow(words.length, next)];
    return capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  let bits = count * Math.log2(words.length);
  if (addNumber) {
    const at = randomBelow(count, next);
    picked[at] += String(randomBelow(10, next));
    bits += Math.log2(10) + Math.log2(count);
  }
  return { password: picked.join(separator), bits };
}

/** A label for the strength of a password with this many bits of randomness. */
export function strength(bits) {
  if (bits < 28) return { level: 0, label: 'Very weak' };
  if (bits < 40) return { level: 1, label: 'Weak' };
  if (bits < 60) return { level: 2, label: 'Fair' };
  if (bits < 80) return { level: 3, label: 'Strong' };
  return { level: 4, label: 'Very strong' };
}

/** Rough average time to guess, for an attacker making `rate` guesses a second (half the possibilities on average). */
export function crackTime(bits, rate = 1e10) {
  const seconds = 2 ** (bits - 1) / rate;
  return { seconds, text: humanTime(seconds) };
}

export function humanTime(seconds) {
  if (seconds < 1) return 'less than a second';
  const units = [
    ['year', 31557600],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const years = seconds / 31557600;
  if (years >= 1e12) return 'trillions of years';
  if (years >= 1e9) return 'billions of years';
  if (years >= 1e6) return 'millions of years';
  if (years >= 1000) return `${Math.round(years / 1000).toLocaleString('en-US')} thousand years`;
  for (const [name, size] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `${n.toLocaleString('en-US')} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return 'less than a second';
}
