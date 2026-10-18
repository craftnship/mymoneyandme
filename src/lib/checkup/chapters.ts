import type { DimensionKey } from "../rulepack/schema";

/** Chapter each dimension card links to (track/module/chapter under /learn). */
export const DIMENSION_CHAPTERS: Record<DimensionKey, string> = {
  cashflow: "adults/money-basics/budgeting",
  emergency: "adults/money-basics/emergency-fund",
  debt: "adults/banking-and-credit/loans-and-emis",
  insurance: "adults/insurance/term-life",
  investments: "adults/investing-fundamentals/asset-allocation",
  retirement: "adults/retirement-planning/how-much-is-enough",
  goals: "adults/money-basics/goal-setting",
  hygiene: "adults/estate-planning/nominations",
};

export function chapterHref(chapter: string): string {
  return `/learn/${chapter}`;
}

/** How each metric is displayed on a dimension card. */
export type MetricKind = "percent" | "months" | "multiple" | "bool" | "inr";

export const METRIC_KINDS: Record<string, MetricKind> = {
  savingsRate: "percent",
  essentialShare: "percent",
  emergencyMonths: "months",
  emiToIncome: "percent",
  highCostDebtShare: "percent",
  lifeCoverMultiple: "multiple",
  healthCoverRatio: "percent",
  allocationDrift: "percent",
  idleCashShare: "percent",
  targetEquity: "percent",
  equityShare: "percent",
  retirementReadiness: "percent",
  corpusNeeded: "inr",
  projectedCorpus: "inr",
  goalReadiness: "percent",
  nominationsSet: "bool",
  willInPlace: "bool",
  investable: "inr",
};
