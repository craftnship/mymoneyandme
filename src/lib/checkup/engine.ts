import { CURRENT_RULEPACK_VERSION, getRulePack } from "../rulepack";
import type { Band, Dimension, DimensionKey, RulePack } from "../rulepack/schema";
import { fvLumpsum, fvSip, inflate, pvGrowingAnnuity } from "../calculators/math";

/**
 * Financial health check-up (section 9). The engine is pure: it takes a
 * household snapshot and a rule-pack version and returns a reproducible score.
 * Clients never score locally; the API route calls this so every stored result
 * carries the rule-set version that produced it.
 */

export type LifeStage = "student" | "earlyCareer" | "family" | "preRetirement" | "retired";
export type EmploymentType = "salaried" | "selfEmployed" | "business" | "retired" | "student" | "homemaker";

export type HouseholdSnapshot = {
  age: number;
  employment: EmploymentType;
  dualIncome?: boolean;
  dependants: number;
  cityTier: 1 | 2 | 3;
  retirementAge?: number;
  monthlyIncome: number; // take-home, all earners
  monthlyExpenses: number;
  monthlyEssentialExpenses?: number; // defaults to 60% of expenses
  liquidAssets: number; // cash, bank, liquid funds
  investments: { equity: number; debt: number; gold: number; realEstate: number; other?: number };
  retirementCorpus: number; // EPF, PPF, NPS, retirement-tagged investments
  monthlyEmi: number;
  highCostDebt: number; // credit-card revolving, personal loans above 15%
  totalDebt: number;
  lifeCover: number;
  healthCover: number; // per member (family floater counts in full)
  goals?: { targetToday: number; years: number; assigned: number; monthlySip: number }[];
  nominationsSet?: boolean;
  willInPlace?: boolean;
  monthlyRetirementSip?: number;
  /** Which fields were actually entered; missing ones use defaults and lower confidence. */
  provided?: string[];
};

export type DimensionResult = {
  key: DimensionKey;
  weight: number;
  score: number; // 0–100
  status: "good" | "watch" | "act";
  metrics: Record<string, number>;
};

export type CheckUpResult = {
  rulePackVersion: string;
  computedAt: string;
  lifeStage: LifeStage;
  overall: number;
  grade: string;
  confidence: "high" | "medium" | "low";
  dimensions: DimensionResult[];
  strengths: DimensionKey[];
  risks: DimensionKey[];
  metrics: Record<string, number>;
};

export function lifeStageFor(age: number, employment: EmploymentType): LifeStage {
  if (employment === "student") return "student";
  if (employment === "retired" || age >= 60) return "retired";
  if (age >= 50) return "preRetirement";
  if (age < 30) return "earlyCareer";
  return "family";
}

function scoreBands(value: number, bands: Band[]): number {
  for (const b of bands) {
    const okGte = b.gte === undefined || value >= b.gte;
    const okLte = b.lte === undefined || value <= b.lte;
    if (okGte && okLte) return b.score;
  }
  return 0;
}

function statusFor(score: number): DimensionResult["status"] {
  if (score >= 70) return "good";
  if (score >= 45) return "watch";
  return "act";
}

export function computeMetrics(h: HouseholdSnapshot, pack: RulePack): Record<string, number> {
  const a = pack.assumptions;
  const income = Math.max(1, h.monthlyIncome);
  const essential = h.monthlyEssentialExpenses ?? h.monthlyExpenses * 0.6;
  const inv = h.investments;
  const investable = inv.equity + inv.debt + inv.gold + inv.realEstate + (inv.other ?? 0) + h.liquidAssets;

  // Cash flow
  const savingsRate = (income - h.monthlyExpenses) / income;
  const essentialShare = essential / income;

  // Emergency fund
  const emergencyMonths = essential > 0 ? h.liquidAssets / essential : 12;

  // Debt
  const emiToIncome = h.monthlyEmi / income;
  const highCostDebtShare = h.totalDebt > 0 ? h.highCostDebt / h.totalDebt : 0;

  // Insurance
  const lifeCoverMultiple = h.lifeCover / (income * 12);
  const tierKey = `tier${h.cityTier}` as const;
  const healthTarget = pack.insurance.healthCoverByCityTier[tierKey] ?? pack.insurance.healthCoverByCityTier.tier1;
  const healthCoverRatio = h.healthCover / healthTarget;

  // Investments: target equity = 100 - age, clamped (defaults in the pack)
  const dim = pack.scoring.dimensions.find((d) => d.key === "investments");
  const eq = dim?.targetEquityByAge ?? { min: 0.3, max: 0.8, formula: "100 - age" };
  const targetEquity = Math.min(eq.max, Math.max(eq.min, (100 - h.age) / 100));
  const financial = inv.equity + inv.debt + inv.gold + (inv.other ?? 0) + h.liquidAssets;
  const equityShare = financial > 0 ? inv.equity / financial : 0;
  const allocationDrift = financial > 0 ? Math.abs(equityShare - targetEquity) : 0;
  const idleCashShare = financial > 0 ? Math.max(0, h.liquidAssets - essential * 6) / financial : 0;

  // Retirement readiness: projected corpus at retirement vs corpus needed.
  const retireAt = h.retirementAge ?? a.defaultRetirementAge;
  const yearsToRetire = Math.max(0, retireAt - h.age);
  const yearsInRetirement = Math.max(1, a.lifeExpectancy - retireAt);
  const expenseAtRetirement = inflate(h.monthlyExpenses * 12, a.inflationGeneral, yearsToRetire);
  const corpusNeeded = pvGrowingAnnuity(expenseAtRetirement, a.returnPostRetirement, a.inflationGeneral, yearsInRetirement);
  const projected =
    fvLumpsum(h.retirementCorpus + inv.equity + inv.debt, a.returnBalanced, yearsToRetire) +
    fvSip(h.monthlyRetirementSip ?? 0, a.returnBalanced, yearsToRetire * 12);
  const retirementReadiness = corpusNeeded > 0 ? projected / corpusNeeded : 1;

  // Goals: share of goal value on track
  let goalReadiness = 1;
  if (h.goals && h.goals.length) {
    let need = 0;
    let have = 0;
    for (const g of h.goals) {
      const target = inflate(g.targetToday, a.inflationGeneral, g.years);
      const future = fvLumpsum(g.assigned, a.returnBalanced, g.years) + fvSip(g.monthlySip, a.returnBalanced, g.years * 12);
      need += target;
      have += Math.min(target, future);
    }
    goalReadiness = need > 0 ? have / need : 1;
  }

  return {
    savingsRate,
    essentialShare,
    emergencyMonths,
    emiToIncome,
    highCostDebtShare,
    lifeCoverMultiple,
    healthCoverRatio,
    allocationDrift,
    idleCashShare,
    targetEquity,
    equityShare,
    retirementReadiness,
    corpusNeeded,
    projectedCorpus: projected,
    goalReadiness,
    nominationsSet: h.nominationsSet ? 1 : 0,
    willInPlace: h.willInPlace || (h.age < 40 && h.dependants === 0) ? 1 : 0,
    investable,
  };
}

function scoreDimension(dim: Dimension, metrics: Record<string, number>): DimensionResult {
  let score = 0;
  const used: Record<string, number> = {};
  for (const rule of dim.rules) {
    const v = metrics[rule.metric] ?? 0;
    used[rule.metric] = v;
    score += scoreBands(v, rule.points) * rule.share;
  }
  score = Math.round(score);
  return { key: dim.key, weight: dim.weight, score, status: statusFor(score), metrics: used };
}

export function runCheckUp(h: HouseholdSnapshot, version = CURRENT_RULEPACK_VERSION): CheckUpResult {
  const pack = getRulePack(version);
  const metrics = computeMetrics(h, pack);
  const stage = lifeStageFor(h.age, h.employment);
  const adjustments = pack.scoring.lifeStageWeightAdjustments[stage] ?? {};

  const dims = pack.scoring.dimensions.map((d) => {
    const r = scoreDimension(d, metrics);
    r.weight = Math.max(0, d.weight + (adjustments[d.key] ?? 0));
    return r;
  });
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0) || 1;
  const overall = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight);
  const grade = pack.scoring.grades.find((g) => overall >= g.min)?.grade ?? "needsAttention";

  const sorted = [...dims].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((d) => d.score >= 70).slice(0, 3).map((d) => d.key);
  const risks = [...sorted].reverse().filter((d) => d.score < 70).slice(0, 3).map((d) => d.key);

  const provided = h.provided?.length ?? Object.keys(h).length;
  const confidence: CheckUpResult["confidence"] = provided >= 14 ? "high" : provided >= 8 ? "medium" : "low";

  return {
    rulePackVersion: version,
    computedAt: new Date().toISOString(),
    lifeStage: stage,
    overall,
    grade,
    confidence,
    dimensions: dims,
    strengths,
    risks,
    metrics,
  };
}

/** Quick check (public, 5 questions): same engine with defaults for missing data. */
export type QuickCheckInput = {
  age: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencySavings: number;
  monthlyEmi: number;
  hasTermCover: boolean;
  hasHealthCover: boolean;
};

export function runQuickCheck(q: QuickCheckInput, version = CURRENT_RULEPACK_VERSION): CheckUpResult {
  const income = q.monthlyIncome;
  const snapshot: HouseholdSnapshot = {
    age: q.age,
    employment: "salaried",
    dependants: 1,
    cityTier: 1,
    monthlyIncome: income,
    monthlyExpenses: q.monthlyExpenses,
    liquidAssets: q.emergencySavings,
    investments: { equity: 0, debt: 0, gold: 0, realEstate: 0 },
    retirementCorpus: 0,
    monthlyEmi: q.monthlyEmi,
    highCostDebt: 0,
    totalDebt: q.monthlyEmi * 60,
    lifeCover: q.hasTermCover ? income * 12 * 12 : 0,
    healthCover: q.hasHealthCover ? 1000000 : 0,
    monthlyRetirementSip: Math.max(0, income - q.monthlyExpenses - q.monthlyEmi) * 0.5,
    nominationsSet: false,
    willInPlace: false,
    provided: ["age", "monthlyIncome", "monthlyExpenses", "emergencySavings", "monthlyEmi", "lifeCover", "healthCover"],
  };
  return runCheckUp(snapshot, version);
}
