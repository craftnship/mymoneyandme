import type { CheckUpResult } from "./engine";
import { getRulePack } from "../rulepack";

/**
 * Recommended plan (section 11): an ordered checklist derived from the
 * check-up, following the fixed priority sequence. Items carry message keys
 * and the numbers behind them; rendering happens in the user's language.
 */
export type PlanItem = {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = stop the bleeding … 7 = review
  dimension: CheckUpResult["dimensions"][number]["key"];
  template: string; // message key under plan.items
  params: Record<string, number | string>;
  effortMinutes: number;
  scoreImpact: number; // expected points gained
  rule: string; // explainability: which metric and threshold produced it
  relatedCalculator?: string;
  relatedChapter?: string;
};

export function buildPlan(result: CheckUpResult, income: number): PlanItem[] {
  const m = result.metrics;
  const pack = getRulePack(result.rulePackVersion);
  const items: PlanItem[] = [];
  const dim = (k: PlanItem["dimension"]) => result.dimensions.find((d) => d.key === k)!;
  const impact = (k: PlanItem["dimension"], targetScore = 100) => Math.round(((targetScore - dim(k).score) * dim(k).weight) / 100);

  // 1. Stop the bleeding
  if (m.savingsRate < 0) {
    items.push({ id: "fix-overspend", priority: 1, dimension: "cashflow", template: "fixOverspend", params: { gap: Math.round(-m.savingsRate * income) }, effortMinutes: 120, scoreImpact: impact("cashflow"), rule: "savingsRate < 0", relatedCalculator: "50-30-20-budget", relatedChapter: "adults/money-basics/budgeting" });
  }
  if (m.highCostDebtShare > 0) {
    items.push({ id: "clear-high-cost-debt", priority: 1, dimension: "debt", template: "clearHighCostDebt", params: { share: Math.round(m.highCostDebtShare * 100) }, effortMinutes: 60, scoreImpact: impact("debt"), rule: "highCostDebtShare > 0", relatedCalculator: "credit-card-minimum-due", relatedChapter: "adults/banking-and-credit/credit-cards" });
  }

  // 2. Protect
  const multiple = pack.insurance.termCoverMultipleOfIncome.min;
  if (m.lifeCoverMultiple < multiple) {
    items.push({ id: "raise-term-cover", priority: 2, dimension: "insurance", template: "raiseTermCover", params: { target: Math.round(income * 12 * multiple), multiple }, effortMinutes: 30, scoreImpact: Math.round(impact("insurance") / 2), rule: `lifeCoverMultiple < ${multiple}`, relatedCalculator: "term-cover", relatedChapter: "adults/insurance/term-life" });
  }
  if (m.healthCoverRatio < 1) {
    items.push({ id: "raise-health-cover", priority: 2, dimension: "insurance", template: "raiseHealthCover", params: { ratio: Math.round(m.healthCoverRatio * 100) }, effortMinutes: 45, scoreImpact: Math.round(impact("insurance") / 2), rule: "healthCoverRatio < 1", relatedCalculator: "health-cover", relatedChapter: "adults/insurance/health-insurance" });
  }
  if (!m.nominationsSet) {
    items.push({ id: "set-nominations", priority: 2, dimension: "hygiene", template: "setNominations", params: {}, effortMinutes: 20, scoreImpact: Math.round(impact("hygiene") / 2), rule: "nominationsSet = 0", relatedChapter: "adults/estate-planning/nominations" });
  }

  // 3. Cushion
  if (m.emergencyMonths < 6) {
    items.push({ id: "build-emergency-fund", priority: 3, dimension: "emergency", template: "buildEmergencyFund", params: { months: Math.round(m.emergencyMonths * 10) / 10, target: 6 }, effortMinutes: 15, scoreImpact: impact("emergency"), rule: "emergencyMonths < 6", relatedCalculator: "emergency-fund", relatedChapter: "adults/money-basics/emergency-fund" });
  }

  // 4. Optimise debt
  if (m.emiToIncome > 0.35) {
    items.push({ id: "reduce-emi-load", priority: 4, dimension: "debt", template: "reduceEmiLoad", params: { share: Math.round(m.emiToIncome * 100) }, effortMinutes: 60, scoreImpact: impact("debt"), rule: "emiToIncome > 0.35", relatedCalculator: "prepayment", relatedChapter: "adults/banking-and-credit/loans-and-emis" });
  }

  // 5. Grow
  if (m.savingsRate >= 0 && m.savingsRate < 0.2) {
    items.push({ id: "raise-savings-rate", priority: 5, dimension: "cashflow", template: "raiseSavingsRate", params: { rate: Math.round(m.savingsRate * 100), target: 20 }, effortMinutes: 60, scoreImpact: impact("cashflow"), rule: "savingsRate < 0.20", relatedCalculator: "savings-rate", relatedChapter: "adults/money-basics/budgeting" });
  }
  if (m.allocationDrift > 0.1) {
    items.push({ id: "rebalance", priority: 5, dimension: "investments", template: "rebalance", params: { equity: Math.round(m.equityShare * 100), target: Math.round(m.targetEquity * 100) }, effortMinutes: 45, scoreImpact: impact("investments"), rule: "allocationDrift > 0.10", relatedChapter: "adults/investing-fundamentals/asset-allocation" });
  }
  if (m.idleCashShare > 0.1) {
    items.push({ id: "deploy-idle-cash", priority: 5, dimension: "investments", template: "deployIdleCash", params: { share: Math.round(m.idleCashShare * 100) }, effortMinutes: 30, scoreImpact: Math.round(impact("investments") / 2), rule: "idleCashShare > 0.10", relatedCalculator: "sip" });
  }
  if (m.goalReadiness < 0.8) {
    items.push({ id: "fund-goals", priority: 5, dimension: "goals", template: "fundGoals", params: { ready: Math.round(m.goalReadiness * 100) }, effortMinutes: 30, scoreImpact: impact("goals"), rule: "goalReadiness < 0.80", relatedCalculator: "goal-sip" });
  }

  // 6. Secure the future
  if (m.retirementReadiness < 1) {
    items.push({ id: "retirement-sip", priority: 6, dimension: "retirement", template: "retirementSip", params: { ready: Math.round(m.retirementReadiness * 100), corpus: Math.round(m.corpusNeeded) }, effortMinutes: 30, scoreImpact: impact("retirement"), rule: "retirementReadiness < 1", relatedCalculator: "retirement-corpus", relatedChapter: "adults/retirement-planning/how-much-is-enough" });
  }
  if (!m.willInPlace) {
    items.push({ id: "write-will", priority: 6, dimension: "hygiene", template: "writeWill", params: {}, effortMinutes: 90, scoreImpact: Math.round(impact("hygiene") / 2), rule: "willInPlace = 0 and (age >= 40 or dependants > 0)", relatedChapter: "adults/estate-planning/wills" });
  }

  // 7. Review
  items.push({ id: "annual-review", priority: 7, dimension: "hygiene", template: "annualReview", params: {}, effortMinutes: 20, scoreImpact: 0, rule: "always" });

  return items.sort((a, b) => a.priority - b.priority || b.scoreImpact - a.scoreImpact);
}
