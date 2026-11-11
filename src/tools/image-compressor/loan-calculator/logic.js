// Fixed-rate loan maths: the standard amortizing payment, a month-by-month schedule, and the
// effect of extra payments. Pure functions, unit tested.

const cents = (n) => Math.round(n * 100) / 100;

/** Monthly payment for principal P at annual rate (percent) over n months. */
export function monthlyPayment(P, annualRatePct, n) {
  if (!(P > 0) || !(n > 0)) return NaN;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return P / n;
  return (P * r) / (1 - (1 + r) ** -n);
}

/**
 * Build the schedule. Interest is charged monthly on the remaining balance and rounded to cents.
 * extra: additional principal paid every month.
 * start: { year, month } (month 1–12) of the first payment.
 * Returns { payment, rows: [{ n, year, month, payment, principal, interest, extra, balance }], totalInterest, totalPaid, months }.
 */
export function amortize({ principal, ratePct, months, extra = 0, start }) {
  const P = Number(principal);
  const n = Math.round(Number(months));
  if (!(P > 0)) throw new RangeError('Enter a loan amount above zero.');
  if (!(n > 0)) throw new RangeError('Enter a loan term of at least one month.');
  if (!(ratePct >= 0)) throw new RangeError('Enter an interest rate of 0 or more.');
  if (n > 1200) throw new RangeError('The term can be at most 100 years.');

  const r = ratePct / 100 / 12;
  const payment = cents(monthlyPayment(P, ratePct, n));
  const extraPay = Math.max(0, Number(extra) || 0);
  const rows = [];
  let balance = P;
  let totalInterest = 0;
  let totalPaid = 0;
  let { year, month } = start || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

  for (let i = 1; balance > 0.004 && i <= n; i++) {
    const interest = cents(balance * r);
    let principalPart = payment - interest;
    let extraPart = extraPay;
    if (principalPart + extraPart >= balance || i === n) {
      // last payment: clear what's left
      principalPart = cents(balance);
      extraPart = 0;
    }
    balance = cents(balance - principalPart - extraPart);
    const paid = cents(principalPart + interest + extraPart);
    totalInterest += interest;
    totalPaid += paid;
    rows.push({ n: i, year, month, payment: paid, principal: cents(principalPart), interest, extra: extraPart, balance: Math.max(0, balance) });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return { payment, rows, totalInterest: cents(totalInterest), totalPaid: cents(totalPaid), months: rows.length };
}

/** Roll a schedule up into calendar years. */
export function byYear(rows) {
  const years = new Map();
  for (const r of rows) {
    const y = years.get(r.year) || { year: r.year, payments: 0, principal: 0, interest: 0, extra: 0, paid: 0, balance: 0 };
    y.payments++;
    y.principal = cents(y.principal + r.principal);
    y.interest = cents(y.interest + r.interest);
    y.extra = cents(y.extra + r.extra);
    y.paid = cents(y.paid + r.payment);
    y.balance = r.balance;
    years.set(r.year, y);
  }
  return [...years.values()];
}

/** The schedule as CSV text for spreadsheets. */
export function toCSV(rows) {
  const head = 'Payment,Month,Amount paid,Principal,Interest,Extra principal,Balance';
  const lines = rows.map((r) => [r.n, `${r.year}-${String(r.month).padStart(2, '0')}`, r.payment.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.extra.toFixed(2), r.balance.toFixed(2)].join(','));
  return [head, ...lines].join('\r\n') + '\r\n';
}
