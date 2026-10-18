import { fvLumpsum, fvSip, inflate, sipForTarget } from "../calculators/math";
import { expectedReturn, mixForHorizon, type AssetMix } from "./templates";
import type { Goal, GoalPriority } from "./model";

/**
 * Goal planner maths (section 10). Pure functions over a goal's numbers so the
 * same figures appear on the goal page, the dashboard and in the check-up.
 */
export type GoalProjection = {
  years: number;
  months: number;
  mix: AssetMix;
  expectedReturn: number;
  futureValue: number; // today's cost inflated to the target date
  projected: number; // what assigned assets plus the SIP grow to by then
  requiredMonthlySip: number; // SIP that would close the gap at the mix's return
  shortfall: number; // positive when projected < futureValue
  progressPct: number; // 0–100, projected ÷ futureValue
  onTrack: boolean;
  /** Months before (positive) or after (negative) the target date that the current path reaches the goal; null when it never does. */
  monthsAhead: number | null;
};

const MS_PER_MONTH = (365.25 / 12) * 24 * 3600 * 1000;

export function monthsBetween(from: Date, to: string | Date): number {
  const end = typeof to === "string" ? new Date(`${to}T00:00:00Z`) : to;
  return Math.max(0, Math.round((end.getTime() - from.getTime()) / MS_PER_MONTH));
}

export function futureValue(targetToday: number, inflationPct: number, years: number): number {
  return inflate(targetToday, inflationPct / 100, years);
}

export function requiredMonthlySip(target: number, assigned: number, years: number, rate: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const gap = target - fvLumpsum(assigned, rate, years);
  if (gap <= 0) return 0;
  return sipForTarget(gap, rate, months);
}

/** First month at which the current path reaches the target; null when it never does within 50 years. */
export function monthsToReach(target: number, assigned: number, monthlySip: number, rate: number): number | null {
  if (target <= 0) return 0;
  const value = (m: number) => fvLumpsum(assigned, rate, m / 12) + fvSip(monthlySip, rate, m);
  const limit = 600;
  if (value(limit) < target) return null;
  let lo = 0;
  let hi = limit;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (value(mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function projectGoal(input: { targetToday: number; inflationPct: number; assignedAmount: number; monthlySip: number; targetDate: string }, now = new Date(), version?: string): GoalProjection {
  const months = monthsBetween(now, input.targetDate);
  const years = months / 12;
  const mix = mixForHorizon(years);
  const rate = expectedReturn(mix, version);
  const fv = futureValue(input.targetToday, input.inflationPct, years);
  const projected = fvLumpsum(input.assignedAmount, rate, years) + fvSip(input.monthlySip, rate, months);
  const required = requiredMonthlySip(fv, input.assignedAmount, years, rate);
  const shortfall = Math.max(0, fv - projected);
  const reach = monthsToReach(fv, input.assignedAmount, input.monthlySip, rate);
  return {
    years,
    months,
    mix,
    expectedReturn: rate,
    futureValue: fv,
    projected,
    requiredMonthlySip: required,
    shortfall,
    progressPct: fv > 0 ? Math.min(100, Math.round((projected / fv) * 100)) : 100,
    onTrack: projected >= fv * 0.98,
    monthsAhead: reach === null ? null : months - reach,
  };
}

export type GoalConflict = {
  totalRequired: number;
  surplus: number;
  shortfall: number;
  /** Nice-to-have goals, costliest first, that could be pushed out or trimmed to fit the surplus. */
  trimCandidates: { id: string; name: string; requiredMonthlySip: number }[];
};

/** Flags when the SIPs needed across goals exceed what the household can invest each month. */
export function findConflicts(goals: (Goal & { projection: GoalProjection })[], investableSurplus: number): GoalConflict | null {
  const totalRequired = goals.reduce((s, g) => s + g.projection.requiredMonthlySip, 0);
  if (totalRequired <= investableSurplus) return null;
  const byPriority: Record<GoalPriority, number> = { must: 0, should: 1, nice: 2 };
  const trimCandidates = goals
    .filter((g) => g.priority === "nice" && g.projection.requiredMonthlySip > 0)
    .sort((a, b) => byPriority[a.priority] - byPriority[b.priority] || b.projection.requiredMonthlySip - a.projection.requiredMonthlySip)
    .map((g) => ({ id: g.id, name: g.name, requiredMonthlySip: g.projection.requiredMonthlySip }));
  return { totalRequired, surplus: investableSurplus, shortfall: totalRequired - investableSurplus, trimCandidates };
}
