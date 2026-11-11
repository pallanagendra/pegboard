import { randomBelow } from '../../assets/js/random-core.js';

/** One fair flip: 'heads' or 'tails'. */
export function flip(next) {
  return randomBelow(2, next) === 0 ? 'heads' : 'tails';
}

/** Several flips at once. */
export function flipMany(count, next) {
  return Array.from({ length: count }, () => flip(next));
}

/** Counts, shares and streaks for a list of flips, oldest first. */
export function tally(results) {
  let heads = 0;
  let longest = { side: null, length: 0 };
  let run = { side: null, length: 0 };
  for (const r of results) {
    if (r === 'heads') heads++;
    run = r === run.side ? { side: r, length: run.length + 1 } : { side: r, length: 1 };
    if (run.length > longest.length) longest = { ...run };
  }
  const total = results.length;
  const tails = total - heads;
  return {
    heads,
    tails,
    total,
    headsPct: total ? (heads / total) * 100 : 0,
    tailsPct: total ? (tails / total) * 100 : 0,
    streak: run,
    longest,
  };
}

/** Chance of getting the same side n times in a row with a fair coin, e.g. 5 → 1 in 32. */
export function sameSideOdds(n) {
  return 2 ** n;
}
