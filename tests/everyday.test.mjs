import test from 'node:test';
import assert from 'node:assert/strict';

import { randomBelow, randomInt, sampleUnique, shuffle, sequence } from '../src/assets/js/random-core.js';
import { tally, sameSideOdds } from '../src/tools/flip-a-coin/logic.js';
import { generate, formatValue, describe } from '../src/tools/random-number-generator/logic.js';
import { rollDice, notation, breakdown, range } from '../src/tools/dice-roller/logic.js';
import {
  SW_EMPTY, swStart, swStop, swLap, swElapsed, lapExtremes, stopwatchParts, formatStopwatch, lapsToText,
  TIMER_EMPTY, durationFromParts, timerSet, timerStart, timerPause, timerRemaining, timerAdd, timerDone, timerReset, formatTimer, describeDuration,
} from '../src/tools/stopwatch/logic.js';
import { parseEntries, indexAtRotation, targetRotation, planSpin, removeEntry, slicePath, sliceColours } from '../src/tools/spin-the-wheel/logic.js';
import { WORDS, makeWords, countKeys, scoreTest, speedBand } from '../src/tools/typing-test/logic.js';

test('random: rejection sampling throws away the biased top of the range', () => {
  // 2^32 % 3 === 1, so 4294967295 is the one value that must be skipped
  assert.equal(randomBelow(3, sequence(4294967295, 5)), 2);
  assert.equal(randomBelow(1, sequence(123)), 0);
  assert.throws(() => randomBelow(0));
  assert.throws(() => randomBelow(1.5));
  assert.equal(randomInt(-3, 3, sequence(0)), -3);
  assert.equal(randomInt(-3, 3, sequence(6)), 3);
  const big = randomBelow(2 ** 40, sequence(0xffffffff, 0xffffffff, 7, 9));
  assert.ok(big >= 0 && big < 2 ** 40);
});

test('random: every face of a die comes up about equally often', () => {
  const counts = Array(6).fill(0);
  for (let i = 0; i < 60000; i++) counts[randomBelow(6)]++;
  for (const c of counts) assert.ok(Math.abs(c - 10000) < 600, `count ${c} is too far from 10000`);
});

test('random: unique samples and shuffles', () => {
  const six = sampleUnique(1, 49, 6);
  assert.equal(new Set(six).size, 6);
  assert.ok(six.every((n) => n >= 1 && n <= 49));
  assert.deepEqual([...sampleUnique(1, 5, 5)].sort(), [1, 2, 3, 4, 5]);
  assert.throws(() => sampleUnique(1, 3, 4));
  const wide = sampleUnique(1, 1e9, 1000);
  assert.equal(new Set(wide).size, 1000);
  assert.deepEqual(shuffle(['a', 'b', 'c', 'd']).sort(), ['a', 'b', 'c', 'd']);
});

test('coin: tally counts sides and streaks', () => {
  const t = tally(['heads', 'heads', 'tails', 'heads', 'heads', 'heads']);
  assert.equal(t.heads, 5);
  assert.equal(t.tails, 1);
  assert.deepEqual(t.streak, { side: 'heads', length: 3 });
  assert.deepEqual(t.longest, { side: 'heads', length: 3 });
  assert.equal(Math.round(t.headsPct), 83);
  assert.equal(tally([]).total, 0);
  assert.equal(sameSideOdds(5), 32);
});

test('random numbers: ranges, no repeats, decimals and errors', () => {
  const all = generate({ min: 1, max: 10, count: 10, unique: true, sort: true });
  assert.deepEqual(all.numbers, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  const dec = generate({ min: 0, max: 1, count: 200, decimals: 2 });
  assert.ok(dec.numbers.every((s) => /^[01]\.\d\d$/.test(s) && Number(s) >= 0 && Number(s) <= 1));
  const swapped = generate({ min: 10, max: 1, count: 1 });
  assert.ok(swapped.swapped && swapped.values[0] >= 1 && swapped.values[0] <= 10);
  assert.match(generate({ min: 1, max: 5, count: 6, unique: true }).error, /only 5 different/);
  assert.match(generate({ min: '', max: 5 }).error, /lowest/);
  assert.match(generate({ min: 1, max: 5, count: 20000 }).error, /up to 10,000/);
  assert.match(generate({ min: 0.11, max: 0.19, decimals: 0 }).error, /no number/);
  assert.equal(formatValue(-0, 0), '0');
  assert.equal(describe({ count: 6, unique: true, sort: true, decimals: 0 }, 1, 49), '6 numbers from 1 to 49, no repeats, sorted');
});

test('dice: rolls, notation and totals', () => {
  const r = rollDice({ count: 2, sides: 6, modifier: 3 }, sequence(3, 4));
  assert.deepEqual(r.rolls, [4, 5]);
  assert.equal(r.total, 12);
  assert.equal(notation(r), '2d6+3');
  assert.equal(breakdown(r), '4 + 5 + 3 = 12');
  assert.equal(notation({ count: 1, sides: 20, modifier: -2 }), '1d20−2');
  assert.deepEqual(range({ count: 2, sides: 6 }), { min: 2, max: 12, average: 7 });
  assert.ok(rollDice({ count: 51, sides: 6 }).error);
  assert.ok(rollDice({ count: 1, sides: 7 }).error);
  for (let i = 0; i < 200; i++) {
    const d = rollDice({ count: 1, sides: 20 });
    assert.ok(d.total >= 1 && d.total <= 20);
  }
});

test('stopwatch: start, stop, resume and laps', () => {
  let sw = swStart(SW_EMPTY, 1000);
  sw = swStop(sw, 3500);
  assert.equal(swElapsed(sw, 9999), 2500);
  sw = swStart(sw, 5000);
  sw = swLap(sw, 6000);
  sw = swLap(sw, 7250);
  sw = swLap(sw, 9000);
  assert.deepEqual(sw.laps.map((l) => l.split), [3500, 1250, 1750]);
  assert.deepEqual(lapExtremes(sw.laps), { fastest: 1, slowest: 0 });
  assert.deepEqual(stopwatchParts(3723456), { main: '1:02:03', fraction: '.45' });
  assert.equal(formatStopwatch(61010), '01:01.01');
  assert.match(lapsToText(sw.laps), /^Lap\tLap time\tTotal\n1\t00:03.50\t00:03.50/);
});

test('timer: set, run, pause, add time and finish', () => {
  assert.equal(durationFromParts('', '5', ''), 300000);
  assert.equal(durationFromParts('1', '30', '15'), 5415000);
  assert.ok(Number.isNaN(durationFromParts('-1', '', '')));
  let t = timerSet(TIMER_EMPTY, 300000);
  t = timerStart(t, 0);
  assert.equal(timerRemaining(t, 1000), 299000);
  t = timerPause(t, 60000);
  assert.equal(timerRemaining(t, 999999), 240000);
  t = timerAdd(t, 60000, 70000);
  assert.equal(t.remaining, 300000);
  t = timerStart(t, 100000);
  assert.ok(!timerDone(t, 399999));
  assert.ok(timerDone(t, 400000));
  assert.equal(timerReset(t).remaining, t.duration);
  assert.equal(formatTimer(299001), '05:00');
  assert.equal(formatTimer(299000), '04:59');
  assert.equal(formatTimer(3600000), '1:00:00');
  assert.equal(formatTimer(0), '00:00');
  assert.equal(describeDuration(5400000), '1 hour 30 minutes');
  assert.equal(describeDuration(45000), '45 seconds');
});

test('wheel: the planned stop always lands on the chosen slice', () => {
  for (const n of [1, 2, 3, 7, 8, 13, 200]) {
    for (let index = 0; index < Math.min(n, 20); index++) {
      for (const jitter of [0, 0.5, 1]) {
        for (const current of [0, 123.4, -50, 7200.75]) {
          const r = targetRotation(current, index, n, { turns: 5, jitter });
          assert.equal(indexAtRotation(r, n), index, `n=${n} index=${index} jitter=${jitter} current=${current}`);
          assert.ok(r >= current + 5 * 360, 'spins forward at least the full turns');
        }
      }
    }
  }
  const plan = planSpin(0, 8, sequence(5, 500, 1));
  assert.equal(plan.index, 5);
  assert.equal(indexAtRotation(plan.rotation, 8), 5);
});

test('wheel: entries, removal, slices and colours', () => {
  const { entries } = parseEntries('  Ava \n\nBen\nAva\n');
  assert.deepEqual(entries, ['Ava', 'Ben', 'Ava']);
  assert.equal(parseEntries(Array.from({ length: 250 }, (_, i) => `n${i}`).join('\n')).entries.length, 200);
  assert.equal(removeEntry('Ava\nBen\nAva', 'Ava'), 'Ben\nAva');
  assert.match(slicePath(0, 360), /A100 100 0 1 1/);
  assert.match(slicePath(0, 90), /^M0 0L0\.000 -100\.000A100 100 0 0 1 100\.000 -0\.000Z$/);
  for (const n of [2, 3, 8, 9, 17, 25]) {
    const c = sliceColours(n, 8);
    for (let i = 0; i < n; i++) assert.notEqual(c[i], c[(i + 1) % n], `n=${n} slice ${i}`);
  }
});

test('typing: words, keystrokes and scoring', () => {
  const plain = makeWords(80);
  assert.equal(plain.length, 80);
  assert.ok(plain.every((w) => WORDS.includes(w)));
  const punct = makeWords(80, { punctuation: true });
  assert.match(punct[0], /^[A-Z]/);
  assert.ok(punct.some((w) => /[.?]$/.test(w)));
  assert.deepEqual(countKeys('hello', 'he', 'hel'), { total: 1, correct: 1 });
  assert.deepEqual(countKeys('hello', 'hel', 'helx'), { total: 1, correct: 0 });
  assert.deepEqual(countKeys('the', 'the', 'the '), { total: 1, correct: 1 });
  assert.deepEqual(countKeys('the', 'th', 'th '), { total: 1, correct: 0 });
  assert.deepEqual(countKeys('the', 'thx', 'th'), { total: 0, correct: 0 });
  const s = scoreTest({ words: [{ target: 'the', typed: 'the' }, { target: 'be', typed: 'bx' }], partial: { target: 'of', typed: 'o' }, elapsedMs: 60000, keys: { total: 10, correct: 9 } });
  assert.equal(s.correctChars, 5);
  assert.equal(s.wpm, 1);
  assert.equal(s.raw, 2);
  assert.equal(s.accuracy, 90);
  assert.equal(s.wrongWords, 1);
  // 60 correct five-letter words (plus spaces) in a minute is 72 WPM by the 5-characters rule
  const fast = scoreTest({ words: Array(60).fill({ target: 'world', typed: 'world' }), elapsedMs: 60000 });
  assert.equal(fast.wpm, 72);
  assert.equal(speedBand(45), 'Above average');
});
