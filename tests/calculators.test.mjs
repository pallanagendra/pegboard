// Unit tests for the calculators. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as dates from '../src/assets/js/date-core.js';
import { parseNumber, formatNumber, formatMoney } from '../src/assets/js/number-core.js';
import * as pct from '../src/tools/percentage-calculator/logic.js';
import * as loan from '../src/tools/loan-calculator/logic.js';
import { computeAge } from '../src/tools/age-calculator/logic.js';
import * as time from '../src/tools/time-calculator/logic.js';
import { between, shiftDate } from '../src/tools/days-between-dates/logic.js';

const d = dates.parseISODate;

// ---------------------------------------------------------------- numbers
test('numbers: typed the way people type them', () => {
  assert.equal(parseNumber('1,234.5'), 1234.5);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('0,125'), 0.125);
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('$20,000'), 20000);
  assert.equal(parseNumber(' 1 000 '), 1000);
  assert.equal(parseNumber('-3'), -3);
  assert.equal(parseNumber('15%'), 15);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.equal(formatNumber(1234.5678912, 6, 'en-US'), '1,234.567891');
  assert.equal(formatNumber(0.1 + 0.2, 6, 'en-US'), '0.3');
  assert.equal(formatMoney(396.02, 'USD', 'en-US'), '$396.02');
});

// ---------------------------------------------------------------- dates
test('dates: parsing rejects impossible dates', () => {
  assert.equal(dates.toISODate(d('2024-02-29')), '2024-02-29');
  assert.equal(d('2023-02-29'), null);
  assert.equal(d('2026-13-01'), null);
  assert.equal(dates.todayISO(new Date(2026, 10, 10, 23, 30)), '2026-11-10');
});

test('dates: month arithmetic clamps to the end of the month', () => {
  assert.equal(dates.toISODate(dates.addMonths(d('2026-01-31'), 1)), '2026-02-28');
  assert.equal(dates.toISODate(dates.addMonths(d('2024-01-31'), 1)), '2024-02-29');
  assert.equal(dates.toISODate(dates.addMonths(d('2026-03-31'), -1)), '2026-02-28');
  assert.equal(dates.toISODate(dates.addMonths(d('2026-11-10'), 14)), '2028-01-10');
});

test('dates: calendar difference', () => {
  assert.deepEqual(dates.diffYMD(d('1990-06-15'), d('2026-11-10')), { years: 36, months: 4, days: 26 });
  assert.deepEqual(dates.diffYMD(d('2026-01-31'), d('2026-03-01')), { years: 0, months: 1, days: 1 });
  assert.deepEqual(dates.diffYMD(d('2026-11-10'), d('2026-11-10')), { years: 0, months: 0, days: 0 });
  assert.equal(dates.formatYMD({ years: 1, months: 0, days: 3 }), '1 year, 3 days');
});

test('dates: business days skip weekends', () => {
  // Mon 2 Nov 2026 → Mon 9 Nov 2026: Mon–Fri = 5
  assert.equal(dates.businessDaysBetween(d('2026-11-02'), d('2026-11-09')), 5);
  assert.equal(dates.businessDaysBetween(d('2026-11-02'), d('2026-11-09'), true), 6);
  assert.equal(dates.businessDaysBetween(d('2026-11-07'), d('2026-11-09')), 0); // Sat → Mon
  assert.equal(dates.toISODate(dates.addBusinessDays(d('2026-11-06'), 1)), '2026-11-09'); // Fri + 1 = Mon
  assert.equal(dates.toISODate(dates.addBusinessDays(d('2026-11-09'), -1)), '2026-11-06');
  assert.equal(dates.toISODate(dates.addBusinessDays(d('2026-11-10'), 10)), '2026-11-24');
});

// ---------------------------------------------------------------- percentage
test('percentage: the five questions', () => {
  assert.equal(pct.percentOf(15, 200, 'en-US').value, 30);
  assert.equal(pct.percentOf(15, 200, 'en-US').formula, '15 ÷ 100 × 200 = 30');
  assert.equal(pct.whatPercent(25, 200, 'en-US').text, '12.5%');
  assert.match(pct.whatPercent(1, 0).error, /zero/);
  assert.equal(pct.percentChange(80, 100, 'en-US').text, '+25% increase');
  assert.equal(pct.percentChange(100, 80, 'en-US').text, '-20% decrease');
  assert.equal(pct.percentChange(-50, -25, 'en-US').text, '+50% increase');
  assert.match(pct.percentChange(0, 5).error, /zero/);
  assert.equal(pct.changeBy(80, 25, 'increase').value, 100);
  assert.equal(pct.changeBy(100, 20, 'decrease').value, 80);
  assert.equal(pct.wholeFromPart(30, 15).value, 200);
  assert.equal(pct.percentOf(NaN, 5).error, 'Enter both numbers.');
});

// ---------------------------------------------------------------- loan
test('loan: payment matches the standard formula', () => {
  assert.equal(Math.round(loan.monthlyPayment(20000, 7, 60) * 100) / 100, 396.02);
  assert.equal(Math.round(loan.monthlyPayment(300000, 6.5, 360) * 100) / 100, 1896.2);
  assert.equal(loan.monthlyPayment(12000, 0, 12), 1000);
});

test('loan: schedule pays off exactly', () => {
  const s = loan.amortize({ principal: 20000, ratePct: 7, months: 60, start: { year: 2026, month: 12 } });
  assert.equal(s.payment, 396.02);
  assert.equal(s.months, 60);
  assert.equal(s.rows.at(-1).balance, 0);
  assert.equal(s.totalInterest, 3761.48);
  assert.equal(s.rows[0].interest, 116.67);
  assert.deepEqual([s.rows[1].year, s.rows[1].month], [2027, 1]);
  const years = loan.byYear(s.rows);
  assert.equal(years[0].payments, 1);
  assert.equal(years.at(-1).balance, 0);
  assert.ok(loan.toCSV(s.rows).startsWith('Payment,Month,Amount paid'));
});

test('loan: extra payments shorten the loan and save interest', () => {
  const base = loan.amortize({ principal: 20000, ratePct: 7, months: 60 });
  const extra = loan.amortize({ principal: 20000, ratePct: 7, months: 60, extra: 100 });
  assert.ok(extra.months < base.months, `${extra.months} months`);
  assert.ok(extra.totalInterest < base.totalInterest);
  assert.equal(extra.rows.at(-1).balance, 0);
  assert.throws(() => loan.amortize({ principal: 0, ratePct: 5, months: 12 }), /loan amount/);
});

// ---------------------------------------------------------------- age
test('age: exact age and next birthday', () => {
  const a = computeAge('1990-06-15', '2026-11-10');
  assert.deepEqual([a.years, a.months, a.days], [36, 4, 26]);
  assert.equal(a.totalDays, 13297);
  assert.equal(a.next.turning, 37);
  assert.equal(dates.toISODate(a.next.date), '2027-06-15');
  assert.equal(a.next.days, 217);
  const today = computeAge('2000-11-10', '2026-11-10');
  assert.equal(today.birthdayToday, true);
  assert.equal(today.next.days, 0);
  const leap = computeAge('2000-02-29', '2026-02-28');
  assert.deepEqual([leap.years, leap.months, leap.days], [26, 0, 0]);
  assert.match(computeAge('2030-01-01', '2026-11-10').error, /after/);
});

// ---------------------------------------------------------------- time
test('time: adding durations and decimal hours', () => {
  const total = time.sumDurations([{ h: 2, m: 30 }, { h: 1, m: 45 }, { h: 3, m: 15 }, { sign: '-', m: 30 }]);
  assert.equal(total, 7 * 3600);
  assert.equal(time.formatDuration(27900), '7 h 45 min');
  assert.equal(time.formatClockDuration(27900), '7:45:00');
  assert.equal(time.decimalHours(27900), 7.75);
  assert.equal(time.formatDuration(-90), '−1 min 30 s');
  assert.equal(time.sumDurations([{ h: '1,5' }]), 5400);
});

test('time: between two clock times, across midnight', () => {
  assert.deepEqual(time.timeBetween(time.parseClock('09:00'), time.parseClock('17:30'), 30), { seconds: 8 * 3600, overnight: false });
  assert.deepEqual(time.timeBetween(time.parseClock('22:00'), time.parseClock('06:00')), { seconds: 8 * 3600, overnight: true });
  assert.match(time.timeBetween(time.parseClock('09:00'), time.parseClock('09:30'), 45).error, /break/);
  assert.ok(Number.isNaN(time.parseClock('25:00')));
  assert.deepEqual(time.addToClock(time.parseClock('15:45'), 2.5 * 3600), { seconds: time.parseClock('18:15'), dayOffset: 0 });
  assert.deepEqual(time.addToClock(time.parseClock('23:00'), 2 * 3600), { seconds: 3600, dayOffset: 1 });
  assert.deepEqual(time.addToClock(time.parseClock('01:00'), -2 * 3600), { seconds: 23 * 3600, dayOffset: -1 });
  assert.equal(time.formatClock(time.parseClock('18:15'), 'en-US'), '6:15 PM');
});

// ---------------------------------------------------------------- days between
test('days: between dates', () => {
  const r = between('2026-11-10', '2027-01-01');
  assert.equal(r.days, 52);
  assert.deepEqual([r.weeks, r.weekDays], [7, 3]);
  assert.equal(r.business, 38); // cross-checked with Python's datetime
  assert.equal(between('2026-11-10', '2027-01-01', true).days, 53);
  const back = between('2027-01-01', '2026-11-10');
  assert.equal(back.reversed, true);
  assert.equal(back.days, 52);
});

test('days: adding and subtracting', () => {
  assert.equal(dates.toISODate(shiftDate('2026-11-10', 30, 'days').date), '2026-12-10');
  assert.equal(dates.toISODate(shiftDate('2026-11-10', -2, 'weeks').date), '2026-10-27');
  assert.equal(dates.toISODate(shiftDate('2026-01-31', 1, 'months').date), '2026-02-28');
  assert.equal(dates.toISODate(shiftDate('2024-02-29', 1, 'years').date), '2025-02-28');
  assert.equal(dates.toISODate(shiftDate('2026-11-10', 10, 'business').date), '2026-11-24');
});
