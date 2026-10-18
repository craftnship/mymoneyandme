import type { Formula, SeriesPoint } from "./types";
import {
  amortisation,
  cagr,
  emi,
  fvLumpsum,
  fvSip,
  fvStepUpSip,
  inflate,
  pvGrowingAnnuity,
  realRate,
  sipForTarget,
  tenureForEmi,
  xirr,
} from "./math";
import { getRulePack } from "../rulepack";
import { computeRegime, hraExemption } from "./tax";

/**
 * Formula families (section 6). A calculator definition names one of these by id
 * and supplies the inputs; several definitions can share one family (every goal
 * calculator is `goal`, every scheme calculator with yearly compounding is
 * `yearlyScheme`). Each family returns the headline values plus an optional
 * year-by-year series for charts and tables.
 */

function yearlySipSeries(monthly: number, rate: number, years: number, stepUp = 0): SeriesPoint[] {
  const rows: SeriesPoint[] = [];
  let value = 0;
  let invested = 0;
  let instalment = monthly;
  const i = rate / 12;
  for (let y = 1; y <= years; y++) {
    if (y > 1) instalment *= 1 + stepUp;
    for (let m = 0; m < 12; m++) {
      value = (value + instalment) * (1 + i);
      invested += instalment;
    }
    rows.push({ period: y, invested, value, gains: value - invested });
  }
  return rows;
}

function yearlyLumpsumSeries(principal: number, rate: number, years: number, compounding = 1): SeriesPoint[] {
  const rows: SeriesPoint[] = [];
  for (let y = 1; y <= years; y++) {
    const value = fvLumpsum(principal, rate, y, compounding);
    rows.push({ period: y, invested: principal, value, gains: value - principal });
  }
  return rows;
}

const sip: Formula = ({ monthly, rate, years }) => {
  const months = years * 12;
  const value = fvSip(monthly, rate, months);
  const invested = monthly * months;
  return {
    values: { invested, gains: value - invested, value },
    series: yearlySipSeries(monthly, rate, years),
    split: [
      { key: "invested", value: invested },
      { key: "gains", value: value - invested },
    ],
  };
};

const lumpsum: Formula = ({ amount, rate, years }) => {
  const value = fvLumpsum(amount, rate, years);
  return {
    values: { invested: amount, gains: value - amount, value },
    series: yearlyLumpsumSeries(amount, rate, years),
    split: [
      { key: "invested", value: amount },
      { key: "gains", value: value - amount },
    ],
  };
};

const stepUpSip: Formula = ({ monthly, rate, years, stepUp }) => {
  const { fv, invested } = fvStepUpSip(monthly, rate, years, stepUp);
  const flat = fvSip(monthly, rate, years * 12);
  return {
    values: { invested, gains: fv - invested, value: fv, extraVsFlat: fv - flat },
    series: yearlySipSeries(monthly, rate, years, stepUp),
    split: [
      { key: "invested", value: invested },
      { key: "gains", value: fv - invested },
    ],
  };
};

const sipDelay: Formula = ({ monthly, rate, years, delayYears }) => {
  const now = fvSip(monthly, rate, years * 12);
  const later = fvSip(monthly, rate, Math.max(0, years - delayYears) * 12);
  return {
    values: { valueNow: now, valueDelayed: later, costOfWaiting: now - later },
    split: [
      { key: "valueDelayed", value: later },
      { key: "costOfWaiting", value: now - later },
    ],
  };
};

const goalSip: Formula = ({ target, rate, years }) => {
  const monthly = sipForTarget(target, rate, years * 12);
  const lump = target / Math.pow(1 + rate, years);
  return {
    values: { monthly, invested: monthly * years * 12, lumpsumAlternative: lump },
    series: yearlySipSeries(monthly, rate, years),
  };
};

const swp: Formula = ({ corpus, withdrawal, rate, years }) => {
  const i = rate / 12;
  let balance = corpus;
  let withdrawn = 0;
  const rows: SeriesPoint[] = [];
  let exhaustedMonth = 0;
  for (let m = 1; m <= years * 12; m++) {
    balance = balance * (1 + i) - withdrawal;
    withdrawn += withdrawal;
    if (balance <= 0 && !exhaustedMonth) exhaustedMonth = m;
    if (m % 12 === 0) rows.push({ period: m / 12, value: Math.max(0, balance), withdrawn });
  }
  return {
    values: {
      totalWithdrawn: withdrawn,
      finalValue: Math.max(0, balance),
      lastsYears: exhaustedMonth ? exhaustedMonth / 12 : years,
    },
    series: rows,
  };
};

const stp: Formula = ({ amount, monthlyTransfer, sourceRate, targetRate, months }) => {
  let source = amount;
  let target = 0;
  const si = sourceRate / 12;
  const ti = targetRate / 12;
  for (let m = 0; m < months && source > 0; m++) {
    const t = Math.min(monthlyTransfer, source);
    source = (source - t) * (1 + si);
    target = (target + t) * (1 + ti);
  }
  return { values: { sourceLeft: source, targetValue: target, total: source + target } };
};

const cagrFormula: Formula = ({ start, end, years }) => {
  const r = cagr(start, end, years);
  return { values: { cagr: r, absoluteReturn: end / start - 1 } };
};

const returnsCompare: Formula = ({ start, end, years }) => ({
  values: {
    absoluteReturn: end / start - 1,
    annualised: cagr(start, end, years),
    simpleAnnual: (end / start - 1) / years,
  },
});

const rule72: Formula = ({ rate }) => ({
  values: { yearsToDouble: 72 / (rate * 100), yearsToTriple: 114 / (rate * 100), yearsToQuadruple: 144 / (rate * 100) },
});

const compounding: Formula = ({ amount, rate, years }) => {
  const yearly = fvLumpsum(amount, rate, years, 1);
  const monthly = fvLumpsum(amount, rate, years, 12);
  const simple = amount * (1 + rate * years);
  return {
    values: { simple, yearly, monthly, extraFromCompounding: yearly - simple },
    series: yearlyLumpsumSeries(amount, rate, years),
  };
};

const inflationAdjusted: Formula = ({ amount, rate, inflation, years }) => {
  const nominal = fvLumpsum(amount, rate, years);
  const real = realRate(rate, inflation);
  return { values: { nominalValue: nominal, realRate: real, realValue: fvLumpsum(amount, real, years) } };
};

const expenseRatio: Formula = ({ monthly, rate, years, expenseLow, expenseHigh }) => {
  const low = fvSip(monthly, rate - expenseLow, years * 12);
  const high = fvSip(monthly, rate - expenseHigh, years * 12);
  return { values: { valueLowCost: low, valueHighCost: high, costOfFees: low - high } };
};

const inflationFormula: Formula = ({ amount, inflation, years }) => {
  const future = inflate(amount, inflation, years);
  return {
    values: { futureCost: future, purchasingPower: amount / Math.pow(1 + inflation, years) },
    series: Array.from({ length: years }, (_, k) => ({ period: k + 1, value: inflate(amount, inflation, k + 1) })),
  };
};

/** Term deposit with quarterly compounding (the bank convention). */
const fd: Formula = ({ amount, rate, years }) => {
  const value = fvLumpsum(amount, rate, years, 4);
  return {
    values: { invested: amount, interest: value - amount, value },
    series: yearlyLumpsumSeries(amount, rate, years, 4),
    split: [{ key: "invested", value: amount }, { key: "interest", value: value - amount }],
  };
};

/** Recurring deposit with quarterly compounding on each monthly instalment. */
const rd: Formula = ({ monthly, rate, months }) => {
  let value = 0;
  for (let m = 0; m < months; m++) value += monthly * Math.pow(1 + rate / 4, ((months - m) * 4) / 12);
  const invested = monthly * months;
  return { values: { invested, interest: value - invested, value }, split: [{ key: "invested", value: invested }, { key: "interest", value: value - invested }] };
};

/** Yearly-contribution schemes with annual compounding (PPF, SSY, NPS simplified). */
const yearlyScheme: Formula = ({ yearly, rate, years }) => {
  let value = 0;
  const rows: SeriesPoint[] = [];
  for (let y = 1; y <= years; y++) {
    value = (value + yearly) * (1 + rate);
    rows.push({ period: y, invested: yearly * y, value, gains: value - yearly * y });
  }
  const invested = yearly * years;
  return { values: { invested, interest: value - invested, value }, series: rows, split: [{ key: "invested", value: invested }, { key: "interest", value: value - invested }] };
};

const ssy: Formula = ({ yearly, rate, depositYears, maturityYears }) => {
  let value = 0;
  for (let y = 1; y <= maturityYears; y++) value = (value + (y <= depositYears ? yearly : 0)) * (1 + rate);
  const invested = yearly * depositYears;
  return { values: { invested, interest: value - invested, value } };
};

const epf: Formula = ({ basic, age, retirementAge, rate, salaryGrowth, employeeShare, employerShare }) => {
  let corpus = 0;
  let monthlyBasic = basic;
  const years = Math.max(0, retirementAge - age);
  const rows: SeriesPoint[] = [];
  for (let y = 1; y <= years; y++) {
    const contribution = monthlyBasic * (employeeShare + employerShare) * 12;
    corpus = (corpus + contribution) * (1 + rate);
    rows.push({ period: y, value: corpus });
    monthlyBasic *= 1 + salaryGrowth;
  }
  return { values: { corpus, years }, series: rows };
};

const nps: Formula = ({ monthly, age, retirementAge, rate, annuityShare, annuityRate }) => {
  const years = Math.max(0, retirementAge - age);
  const corpus = fvSip(monthly, rate, years * 12);
  const annuityCorpus = corpus * annuityShare;
  return {
    values: { corpus, lumpsum: corpus - annuityCorpus, annuityCorpus, monthlyPension: (annuityCorpus * annuityRate) / 12 },
    series: yearlySipSeries(monthly, rate, years),
  };
};

const bondYtm: Formula = ({ price, face, coupon, years }) => {
  // Approximate YTM then refine with bisection on the bond price equation (annual coupons).
  const c = face * coupon;
  const pv = (y: number) => {
    let s = 0;
    for (let t = 1; t <= years; t++) s += c / Math.pow(1 + y, t);
    return s + face / Math.pow(1 + y, years);
  };
  let lo = -0.5;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > price) lo = mid;
    else hi = mid;
  }
  const ytm = (lo + hi) / 2;
  return { values: { ytm, currentYield: c / price, totalCoupons: c * years } };
};

const emiFormula: Formula = ({ principal, rate, years }) => {
  const a = amortisation(principal, rate, years * 12);
  const yearly: SeriesPoint[] = [];
  for (let y = 1; y <= years; y++) {
    const slice = a.rows.slice((y - 1) * 12, y * 12);
    yearly.push({
      period: y,
      principal: slice.reduce((s, r) => s + r.principal, 0),
      interest: slice.reduce((s, r) => s + r.interest, 0),
      balance: slice.length ? slice[slice.length - 1].balance : 0,
    });
  }
  return {
    values: { emi: a.emi, totalInterest: a.totalInterest, totalPayment: principal + a.totalInterest },
    series: yearly,
    split: [{ key: "principal", value: principal }, { key: "totalInterest", value: a.totalInterest }],
  };
};

const loanEligibility: Formula = ({ income, existingEmi, rate, years, foir }) => {
  const affordable = Math.max(0, income * foir - existingEmi);
  const i = rate / 12;
  const n = years * 12;
  const principal = i === 0 ? affordable * n : (affordable * (Math.pow(1 + i, n) - 1)) / (i * Math.pow(1 + i, n));
  return { values: { affordableEmi: affordable, eligibleLoan: principal } };
};

const prepayment: Formula = ({ outstanding, rate, monthsLeft, extraMonthly, lumpsum }) => {
  const base = amortisation(outstanding, rate, monthsLeft);
  const afterLump = Math.max(0, outstanding - lumpsum);
  const alt = amortisation(afterLump, rate, monthsLeft, extraMonthly);
  // Keep the EMI the same as before the lumpsum so the tenure shortens.
  const altSameEmi = (() => {
    if (afterLump <= 0) return { months: 0, totalInterest: 0 };
    const i = rate / 12;
    const pay = base.emi + extraMonthly;
    let bal = afterLump;
    let interest = 0;
    let m = 0;
    while (bal > 0.005 && m < 1200) {
      const int = bal * i;
      interest += int;
      bal = bal + int - pay;
      m++;
    }
    return { months: m, totalInterest: interest };
  })();
  void alt;
  return {
    values: {
      interestBefore: base.totalInterest,
      interestAfter: altSameEmi.totalInterest,
      interestSaved: base.totalInterest - altSameEmi.totalInterest,
      monthsSaved: base.months - altSameEmi.months,
    },
  };
};

const tenureVsEmi: Formula = ({ principal, rate, shortYears, longYears }) => {
  const a = amortisation(principal, rate, shortYears * 12);
  const b = amortisation(principal, rate, longYears * 12);
  return {
    values: { emiShort: a.emi, interestShort: a.totalInterest, emiLong: b.emi, interestLong: b.totalInterest, extraInterest: b.totalInterest - a.totalInterest },
  };
};

const balanceTransfer: Formula = ({ outstanding, currentRate, newRate, monthsLeft, transferFee }) => {
  const a = amortisation(outstanding, currentRate, monthsLeft);
  const b = amortisation(outstanding, newRate, monthsLeft);
  const fee = outstanding * transferFee;
  return { values: { emiCurrent: a.emi, emiNew: b.emi, interestSaved: a.totalInterest - b.totalInterest, fee, netSaving: a.totalInterest - b.totalInterest - fee } };
};

const creditCardMinDue: Formula = ({ balance, rate, minDuePercent, minDueFloor }) => {
  const i = rate / 12;
  let bal = balance;
  let months = 0;
  let interest = 0;
  while (bal > 1 && months < 600) {
    const int = bal * i;
    interest += int;
    const pay = Math.max(minDueFloor, bal * minDuePercent, Math.min(bal + int, minDueFloor));
    bal = bal + int - pay;
    months++;
  }
  return { values: { monthsToClear: months, totalInterest: interest, totalPaid: balance + interest } };
};

const rentVsBuy: Formula = ({ price, downPayment, rate, years, rent, rentGrowth, appreciation, investReturn }) => {
  const loan = price - downPayment;
  const a = amortisation(loan, rate, years * 12);
  const homeValue = inflate(price, appreciation, years);
  const buyCost = downPayment + a.emi * a.months;
  // Renting: invest the down payment and, each month, whatever the EMI exceeds the rent by.
  let invested = downPayment;
  let monthlyRent = rent;
  let totalRent = 0;
  const mi = investReturn / 12;
  for (let m = 0; m < years * 12; m++) {
    if (m > 0 && m % 12 === 0) monthlyRent *= 1 + rentGrowth;
    invested = invested * (1 + mi) + Math.max(0, a.emi - monthlyRent);
    totalRent += monthlyRent;
  }
  return { values: { buyNetWorth: homeValue, buyOutlay: buyCost, rentNetWorth: invested, rentOutlay: totalRent, advantage: homeValue - invested } };
};

const termCover: Formula = ({ income, age, retirementAge, loans, goals, existingCover, assets, inflation, rate }) => {
  const years = Math.max(1, retirementAge - age);
  const incomeReplacement = pvGrowingAnnuity(income * 12, rate, inflation, years);
  const need = incomeReplacement + loans + goals - assets - existingCover;
  const multiple = getRulePack().insurance.termCoverMultipleOfIncome;
  return {
    values: {
      incomeReplacement,
      recommendedCover: Math.max(0, need),
      thumbRuleLow: income * 12 * multiple.min,
      thumbRuleHigh: income * 12 * multiple.max,
    },
  };
};

const healthCover: Formula = ({ members, cityTier, age, existingCover }) => {
  const tiers = getRulePack().insurance.healthCoverByCityTier;
  const base = cityTier === 1 ? tiers.tier1 : cityTier === 2 ? tiers.tier2 : tiers.tier3;
  const ageLoad = age >= 50 ? 1.5 : age >= 40 ? 1.25 : 1;
  const recommended = base * ageLoad * (1 + 0.5 * Math.max(0, members - 1));
  return { values: { recommendedCover: recommended, gap: Math.max(0, recommended - existingCover) } };
};

const premiumAffordability: Formula = ({ income, premiums }) => {
  const cap = getRulePack().insurance.maxPremiumShareOfIncome;
  return { values: { share: premiums / (income * 12), ceiling: income * 12 * cap, headroom: income * 12 * cap - premiums } };
};

const retirementCorpus: Formula = ({ age, retirementAge, lifeExpectancy, monthlyExpense, inflation, preReturn, postReturn, existingCorpus }) => {
  const yearsToRetire = Math.max(0, retirementAge - age);
  const yearsInRetirement = Math.max(1, lifeExpectancy - retirementAge);
  const expenseAtRetirement = inflate(monthlyExpense * 12, inflation, yearsToRetire);
  const corpusNeeded = pvGrowingAnnuity(expenseAtRetirement, postReturn, inflation, yearsInRetirement);
  const existingFV = fvLumpsum(existingCorpus, preReturn, yearsToRetire);
  const gap = Math.max(0, corpusNeeded - existingFV);
  const monthly = yearsToRetire > 0 ? sipForTarget(gap, preReturn, yearsToRetire * 12) : gap;
  return {
    values: { expenseAtRetirement: expenseAtRetirement / 12, corpusNeeded, existingFV, gap, monthlySip: monthly, readiness: corpusNeeded > 0 ? existingFV / corpusNeeded : 1 },
  };
};

const retirementAge: Formula = ({ age, corpus, monthlySip, monthlyExpense, inflation, preReturn, postReturn, lifeExpectancy }) => {
  // Find the earliest age at which the projected corpus covers the required corpus.
  for (let r = age + 1; r <= Math.min(lifeExpectancy - 1, 80); r++) {
    const yrs = r - age;
    const projected = fvLumpsum(corpus, preReturn, yrs) + fvSip(monthlySip, preReturn, yrs * 12);
    const need = pvGrowingAnnuity(inflate(monthlyExpense * 12, inflation, yrs), postReturn, inflation, lifeExpectancy - r);
    if (projected >= need) return { values: { retirementAge: r, projectedCorpus: projected, corpusNeeded: need } };
  }
  return { values: { retirementAge: 0, projectedCorpus: 0, corpusNeeded: 0 } };
};

const annuity: Formula = ({ corpus, annuityRate, years, inflation }) => {
  const monthly = (corpus * annuityRate) / 12;
  return { values: { monthlyIncome: monthly, yearlyIncome: monthly * 12, realValueAtEnd: monthly / Math.pow(1 + inflation, years) } };
};

const withdrawalRate: Formula = ({ corpus, monthlyWithdrawal, rate, inflation }) => {
  let bal = corpus;
  let w = monthlyWithdrawal * 12;
  let years = 0;
  const rows: SeriesPoint[] = [];
  while (bal > 0 && years < 60) {
    bal = (bal - w) * (1 + rate);
    w *= 1 + inflation;
    years++;
    rows.push({ period: years, value: Math.max(0, bal) });
  }
  return { values: { withdrawalRate: (monthlyWithdrawal * 12) / corpus, lastsYears: years, safeMonthly: (corpus * getRulePack().assumptions.safeWithdrawalRate) / 12 }, series: rows };
};

const gratuity: Formula = ({ lastSalary, years }) => {
  const g = getRulePack().schemes.gratuity as { daysPerYear: number; daysInMonth: number; maxTaxFree: number; minServiceYears: number };
  const eligible = years >= g.minServiceYears;
  const amount = eligible ? (lastSalary * g.daysPerYear * Math.round(years)) / g.daysInMonth : 0;
  return { values: { gratuity: amount, taxFree: Math.min(amount, g.maxTaxFree), eligible: eligible ? 1 : 0 } };
};

const goal: Formula = ({ costToday, years, inflation, rate, existingSavings, currentSip }) => {
  const target = inflate(costToday, inflation, years);
  const months = years * 12;
  const fromSavings = fvLumpsum(existingSavings, rate, years) + fvSip(currentSip, rate, months);
  const gap = Math.max(0, target - fromSavings);
  return {
    values: { futureCost: target, coveredByExisting: fromSavings, shortfall: gap, monthlySip: sipForTarget(gap, rate, months), onTrack: fromSavings >= target ? 1 : 0 },
    series: Array.from({ length: years }, (_, k) => ({ period: k + 1, target: inflate(costToday, inflation, k + 1), value: fvLumpsum(existingSavings, rate, k + 1) + fvSip(currentSip, rate, (k + 1) * 12) })),
  };
};

const incomeTax: Formula = ({ income, deductions80C, deductions80D, npsExtra, homeLoanInterest, otherDeductions }) => {
  const pack = getRulePack();
  const lim = pack.tax.oldRegime.deductionLimits;
  const d =
    Math.min(deductions80C, lim.section80C) +
    Math.min(deductions80D, lim.section80D_self + lim.section80D_parentsSenior) +
    Math.min(npsExtra, lim.section80CCD1B) +
    Math.min(homeLoanInterest, lim.section24b_homeLoanInterest) +
    otherDeductions;
  const n = computeRegime(pack, "new", income, 0);
  const o = computeRegime(pack, "old", income, d);
  return {
    values: { taxNew: n.totalTax, taxOld: o.totalTax, saving: Math.abs(n.totalTax - o.totalTax), betterRegime: n.totalTax <= o.totalTax ? "new" : "old", taxableNew: n.taxableIncome, taxableOld: o.taxableIncome },
    split: [{ key: "taxNew", value: n.totalTax }, { key: "taxOld", value: o.totalTax }],
  };
};

const hra: Formula = ({ basic, hraReceived, rentPaid, metro }) => {
  const exempt = hraExemption(basic, hraReceived, rentPaid, metro === 1);
  return { values: { exemptHRA: exempt, taxableHRA: Math.max(0, hraReceived - exempt) } };
};

const capitalGains: Formula = ({ buy, sell, holdingMonths, assetType }) => {
  const cg = getRulePack().tax.capitalGains as Record<string, { rate?: number; exemption?: number; holdingMonths?: number }>;
  const gain = Math.max(0, sell - buy);
  let tax = 0;
  let kind = "";
  if (assetType === 1) {
    const longTerm = holdingMonths >= (cg.equityLTCG.holdingMonths ?? 12);
    kind = longTerm ? "ltcg" : "stcg";
    tax = longTerm ? Math.max(0, gain - (cg.equityLTCG.exemption ?? 0)) * (cg.equityLTCG.rate ?? 0) : gain * (cg.equitySTCG.rate ?? 0);
  } else if (assetType === 2) {
    const longTerm = holdingMonths >= (cg.propertyLTCG.holdingMonths ?? 24);
    kind = longTerm ? "ltcg" : "stcg";
    tax = longTerm ? gain * (cg.propertyLTCG.rate ?? 0) : gain * 0.3;
  } else {
    kind = "slab";
    tax = gain * 0.3;
  }
  return { values: { gain, tax, netGain: gain - tax, kind } };
};

const takeHome: Formula = ({ ctc, basicShare, employerPfShare, professionalTax, deductions80C }) => {
  const pack = getRulePack();
  const basic = ctc * basicShare;
  const epfCfg = pack.schemes.epf as { employeeShare: number; employerShare: number };
  const employerPf = Math.min(basic, 15000 * 12) * employerPfShare;
  const employeePf = Math.min(basic, 15000 * 12) * epfCfg.employeeShare;
  const gross = ctc - employerPf;
  const n = computeRegime(pack, "new", gross, 0);
  const o = computeRegime(pack, "old", gross, Math.min(deductions80C + employeePf, pack.tax.oldRegime.deductionLimits.section80C));
  const tax = Math.min(n.totalTax, o.totalTax);
  const annualTakeHome = gross - employeePf - professionalTax * 12 - tax;
  return { values: { grossSalary: gross, employeePf, incomeTax: tax, annualTakeHome, monthlyTakeHome: annualTakeHome / 12 } };
};

const budget503020: Formula = ({ income }) => ({
  values: { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 },
  split: [{ key: "needs", value: income * 0.5 }, { key: "wants", value: income * 0.3 }, { key: "savings", value: income * 0.2 }],
});

const emergencyFund: Formula = ({ essentialExpenses, months, existing }) => {
  const target = essentialExpenses * months;
  return { values: { target, gap: Math.max(0, target - existing), coveredMonths: essentialExpenses > 0 ? existing / essentialExpenses : 0 } };
};

const netWorth: Formula = ({ cash, investments, retirement, property, otherAssets, homeLoan, otherLoans, cardDebt }) => {
  const assets = cash + investments + retirement + property + otherAssets;
  const liabilities = homeLoan + otherLoans + cardDebt;
  return {
    values: { assets, liabilities, netWorth: assets - liabilities, liquidNetWorth: cash + investments - cardDebt - otherLoans },
    split: [{ key: "assets", value: assets }, { key: "liabilities", value: liabilities }],
  };
};

const dti: Formula = ({ income, emis, cardPayments }) => ({ values: { ratio: (emis + cardPayments) / income, headroom: Math.max(0, income * 0.35 - emis - cardPayments) } });

const savingsRate: Formula = ({ income, expenses }) => ({ values: { savings: income - expenses, rate: income > 0 ? (income - expenses) / income : 0 } });

const financialFreedom: Formula = ({ monthlyExpense, inflation, yearsToFreedom, withdrawalRate }) => {
  const futureExpense = inflate(monthlyExpense * 12, inflation, yearsToFreedom);
  return { values: { freedomNumber: futureExpense / withdrawalRate, freedomNumberToday: (monthlyExpense * 12) / withdrawalRate } };
};

const currency: Formula = ({ amount, rate }) => ({ values: { converted: amount * rate } });

const goldReturns: Formula = ({ grams, buyPrice, sellPrice, years, makingCharge }) => {
  const cost = grams * buyPrice * (1 + makingCharge);
  const value = grams * sellPrice;
  return { values: { invested: cost, value, gain: value - cost, cagr: cagr(cost, value, years) } };
};

const hikeVsInflation: Formula = ({ salary, hike, inflation }) => {
  const real = realRate(hike, inflation);
  return { values: { newSalary: salary * (1 + hike), realHike: real, realSalary: salary * (1 + real) } };
};

const costOfHabit: Formula = ({ monthlySpend, years, rate }) => {
  const spent = monthlySpend * 12 * years;
  const invested = fvSip(monthlySpend, rate, years * 12);
  return { values: { spent, ifInvested: invested, opportunityCost: invested - spent } };
};

const xirrFormula: Formula = ({ monthly, months, currentValue }) => {
  // Approximates XIRR for a regular monthly SIP ending today; only the spacing
  // between cashflows matters, so dates are relative to the first instalment.
  // The full dated-cashflow version is wired through the API once members can
  // store transactions.
  const month = 30.4375 * 864e5;
  const flows = Array.from({ length: months }, (_, k) => ({ date: k * month, amount: -monthly }));
  flows.push({ date: months * month, amount: currentValue });
  return { values: { xirr: xirr(flows), invested: monthly * months, gain: currentValue - monthly * months } };
};

const emiToTenure: Formula = ({ principal, rate, emiAmount }) => {
  const months = tenureForEmi(principal, rate, emiAmount);
  return { values: { months: Number.isFinite(months) ? Math.ceil(months) : 0, feasible: Number.isFinite(months) ? 1 : 0, minimumEmi: emi(principal, rate, 360) } };
};

export const FORMULAS: Record<string, Formula> = {
  sip,
  lumpsum,
  stepUpSip,
  sipDelay,
  goalSip,
  swp,
  stp,
  cagr: cagrFormula,
  returnsCompare,
  rule72,
  compounding,
  inflationAdjusted,
  expenseRatio,
  inflation: inflationFormula,
  fd,
  rd,
  yearlyScheme,
  ssy,
  epf,
  nps,
  bondYtm,
  emi: emiFormula,
  loanEligibility,
  prepayment,
  tenureVsEmi,
  balanceTransfer,
  creditCardMinDue,
  rentVsBuy,
  termCover,
  healthCover,
  premiumAffordability,
  retirementCorpus,
  retirementAge,
  annuity,
  withdrawalRate,
  gratuity,
  goal,
  incomeTax,
  hra,
  capitalGains,
  takeHome,
  budget503020,
  emergencyFund,
  netWorth,
  dti,
  savingsRate,
  financialFreedom,
  currency,
  goldReturns,
  hikeVsInflation,
  costOfHabit,
  xirr: xirrFormula,
  emiToTenure,
};
