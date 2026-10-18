/** Shared finance maths used by every formula family. Rates are decimals (0.12 = 12%). */

export function fvLumpsum(principal: number, annualRate: number, years: number, compoundingPerYear = 1) {
  const i = annualRate / compoundingPerYear;
  return principal * Math.pow(1 + i, years * compoundingPerYear);
}

/** Future value of a level monthly SIP, instalments at the start of each month (annuity due). */
export function fvSip(monthly: number, annualRate: number, months: number) {
  const i = annualRate / 12;
  if (i === 0) return monthly * months;
  return monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
}

/** Monthly SIP needed to reach a target with annuity-due compounding. */
export function sipForTarget(target: number, annualRate: number, months: number) {
  const i = annualRate / 12;
  if (i === 0) return target / months;
  return target / (((Math.pow(1 + i, months) - 1) / i) * (1 + i));
}

/** Step-up SIP: instalment rises by stepUp every 12 months. Returns FV and total invested. */
export function fvStepUpSip(monthly: number, annualRate: number, years: number, stepUp: number) {
  const i = annualRate / 12;
  let fv = 0;
  let invested = 0;
  let instalment = monthly;
  for (let m = 0; m < years * 12; m++) {
    if (m > 0 && m % 12 === 0) instalment *= 1 + stepUp;
    fv = (fv + instalment) * (1 + i);
    invested += instalment;
  }
  return { fv, invested };
}

export function emi(principal: number, annualRate: number, months: number) {
  const i = annualRate / 12;
  if (i === 0) return principal / months;
  return (principal * i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
}

/** Months needed to repay at a given EMI. */
export function tenureForEmi(principal: number, annualRate: number, emiAmount: number) {
  const i = annualRate / 12;
  if (i === 0) return principal / emiAmount;
  if (emiAmount <= principal * i) return Infinity;
  return Math.log(emiAmount / (emiAmount - principal * i)) / Math.log(1 + i);
}

export function amortisation(principal: number, annualRate: number, months: number, extraMonthly = 0) {
  const pay = emi(principal, annualRate, months);
  const i = annualRate / 12;
  const rows: { month: number; interest: number; principal: number; balance: number }[] = [];
  let balance = principal;
  let totalInterest = 0;
  for (let m = 1; m <= months && balance > 0.005; m++) {
    const interest = balance * i;
    let principalPart = pay - interest + extraMonthly;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interest;
    rows.push({ month: m, interest, principal: principalPart, balance: Math.max(0, balance) });
  }
  return { emi: pay, rows, totalInterest, months: rows.length };
}

export function cagr(start: number, end: number, years: number) {
  if (start <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Real (inflation-adjusted) rate via Fisher. */
export function realRate(nominal: number, inflation: number) {
  return (1 + nominal) / (1 + inflation) - 1;
}

export function inflate(amount: number, inflation: number, years: number) {
  return amount * Math.pow(1 + inflation, years);
}

/** Present value of an inflation-indexed annuity (growing annuity), yearly, first payment at start. */
export function pvGrowingAnnuity(payment: number, rate: number, growth: number, years: number) {
  if (years <= 0) return 0;
  if (Math.abs(rate - growth) < 1e-9) return payment * years;
  const g = (1 + growth) / (1 + rate);
  return payment * ((1 - Math.pow(g, years)) / (1 - g));
}

/** XIRR via Newton-Raphson with bisection fallback; cashflows as {date (ms), amount}. */
export function xirr(flows: { date: number; amount: number }[]): number {
  if (flows.length < 2) return 0;
  const t0 = flows[0].date;
  const years = flows.map((f) => (f.date - t0) / (365.25 * 24 * 3600 * 1000));
  const npv = (r: number) => flows.reduce((s, f, k) => s + f.amount / Math.pow(1 + r, years[k]), 0);
  let lo = -0.99;
  let hi = 10;
  let r = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    const v = npv(r);
    const d = flows.reduce((s, f, k) => s - (years[k] * f.amount) / Math.pow(1 + r, years[k] + 1), 0);
    const next = d !== 0 ? r - v / d : r;
    if (Number.isFinite(next) && next > lo && next < hi) {
      if (Math.abs(next - r) < 1e-8) return next;
      r = next;
    } else {
      // bisection step
      const mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) < 0) hi = mid;
      else lo = mid;
      r = (lo + hi) / 2;
    }
  }
  return r;
}

export function round(n: number, decimals = 0) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
