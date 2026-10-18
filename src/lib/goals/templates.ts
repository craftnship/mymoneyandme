import { getRulePack } from "../rulepack";

/**
 * Goal templates (section 10): each carries the inflation series that applies
 * to it, a horizon hint used to pre-fill the target date and whether it is
 * usually linked to a family member. Rates come from the rule pack so a Budget
 * or inflation update changes every template at once.
 */
export type InflationSeries = "general" | "education" | "healthcare" | "lifestyle" | "none";

export type GoalTemplate = {
  key: string;
  inflation: InflationSeries;
  horizonYearsHint: number;
  memberLinked: boolean;
};

export const GOAL_TEMPLATES: readonly GoalTemplate[] = [
  { key: "emergencyFund", inflation: "general", horizonYearsHint: 1, memberLinked: false },
  { key: "childEducationSchool", inflation: "education", horizonYearsHint: 3, memberLinked: true },
  { key: "childEducationUndergrad", inflation: "education", horizonYearsHint: 10, memberLinked: true },
  { key: "childEducationPostgrad", inflation: "education", horizonYearsHint: 14, memberLinked: true },
  { key: "childEducationAbroad", inflation: "education", horizonYearsHint: 12, memberLinked: true },
  { key: "childWedding", inflation: "lifestyle", horizonYearsHint: 15, memberLinked: true },
  { key: "homePurchase", inflation: "general", horizonYearsHint: 5, memberLinked: false },
  { key: "homeRenovation", inflation: "general", horizonYearsHint: 3, memberLinked: false },
  { key: "vehicle", inflation: "general", horizonYearsHint: 3, memberLinked: false },
  { key: "vacation", inflation: "lifestyle", horizonYearsHint: 2, memberLinked: false },
  { key: "business", inflation: "general", horizonYearsHint: 4, memberLinked: false },
  { key: "debtFree", inflation: "none", horizonYearsHint: 5, memberLinked: false },
  { key: "retirement", inflation: "general", horizonYearsHint: 25, memberLinked: true },
  { key: "parentsCare", inflation: "healthcare", horizonYearsHint: 5, memberLinked: true },
  { key: "wealth", inflation: "none", horizonYearsHint: 10, memberLinked: false },
  { key: "custom", inflation: "general", horizonYearsHint: 5, memberLinked: false },
] as const;

export const GOAL_TEMPLATE_KEYS = GOAL_TEMPLATES.map((t) => t.key);

export function getTemplate(key: string): GoalTemplate {
  return GOAL_TEMPLATES.find((t) => t.key === key) ?? GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1];
}

/** Default yearly inflation for a template, in percent (e.g. 10 for education). */
export function defaultInflationPct(templateKey: string, version?: string): number {
  const a = getRulePack(version).assumptions;
  const series = getTemplate(templateKey).inflation;
  const rate = series === "education" ? a.inflationEducation : series === "healthcare" ? a.inflationHealthcare : series === "lifestyle" ? a.inflationLifestyle : series === "none" ? 0 : a.inflationGeneral;
  return Math.round(rate * 1000) / 10;
}

/** Suggested asset mix by horizon (shares sum to 1). */
export type AssetMix = { horizon: "short" | "medium" | "long"; equity: number; debt: number; liquid: number };

export function mixForHorizon(years: number): AssetMix {
  if (years < 3) return { horizon: "short", equity: 0.1, debt: 0.6, liquid: 0.3 };
  if (years <= 7) return { horizon: "medium", equity: 0.5, debt: 0.45, liquid: 0.05 };
  return { horizon: "long", equity: 0.75, debt: 0.25, liquid: 0 };
}

/**
 * Expected yearly return of a mix at the pack's long-run assumptions. Because
 * the mix is chosen from the years left, the expected return steps down as the
 * date approaches: a simple glide path that de-risks in the last three years.
 */
export function expectedReturn(mix: AssetMix, version?: string): number {
  const a = getRulePack(version).assumptions;
  return mix.equity * a.returnEquity + mix.debt * a.returnDebt + mix.liquid * a.returnLiquid;
}

/** ISO date `years` from today, used to pre-fill the target date. */
export function dateYearsFromNow(years: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear() + years, now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}
