import type { HouseholdSnapshot } from "./engine";
import type { PlanItem } from "./plan";
import { getRulePack } from "../rulepack";
import type { RulePack } from "../rulepack/schema";
import type { SnapshotField } from "../data/snapshot";

/**
 * "How we calculated this": for every scored metric, the inputs it used, the
 * formula in words (a message key) and the planning assumptions it leaned on.
 * Pure, built from the stored snapshot, so a check-up from last year traces to
 * exactly the numbers and rule pack that produced it.
 */
export type TraceInput = {
  /** Snapshot field the value came from, which decides the label and the "edit" link. */
  field: SnapshotField | "monthlyEssentialExpenses" | "highCostDebt" | "totalDebt" | "equityShare" | "targetEquity" | "projectedCorpus" | "corpusNeeded" | "financialAssets";
  value: number;
  kind: "inrMonthly" | "inr" | "years" | "count" | "percent" | "bool";
  /** True when the member never entered this and the engine used a default. */
  defaulted?: boolean;
};

export type TraceAssumption = { key: string; value: number; kind: "percent" | "years" | "age" | "inr" | "multiple" };

export type MetricTrace = {
  metric: string;
  inputs: TraceInput[];
  assumptions: TraceAssumption[];
  /** Fields among the inputs that rest on estimates. */
  estimated: string[];
};

const pct = (key: string, value: number): TraceAssumption => ({ key, value, kind: "percent" });

export function traceMetric(metric: string, h: HouseholdSnapshot, pack: RulePack = getRulePack()): MetricTrace | undefined {
  const a = pack.assumptions;
  const provided = new Set(h.provided ?? []);
  const inp = (field: TraceInput["field"], value: number, kind: TraceInput["kind"], providedAs?: SnapshotField): TraceInput => ({
    field,
    value,
    kind,
    defaulted: providedAs ? !provided.has(providedAs) : undefined,
  });
  const essential = h.monthlyEssentialExpenses ?? h.monthlyExpenses * 0.6;
  const essentialInput: TraceInput = { field: "monthlyEssentialExpenses", value: essential, kind: "inrMonthly", defaulted: h.monthlyEssentialExpenses === undefined };
  const inv = h.investments;
  const financial = inv.equity + inv.debt + inv.gold + (inv.other ?? 0) + h.liquidAssets;
  const retireAt = h.retirementAge ?? a.defaultRetirementAge;

  let inputs: TraceInput[];
  let assumptions: TraceAssumption[] = [];
  switch (metric) {
    case "savingsRate":
      inputs = [inp("monthlyIncome", h.monthlyIncome, "inrMonthly", "monthlyIncome"), inp("monthlyExpenses", h.monthlyExpenses, "inrMonthly", "monthlyExpenses")];
      break;
    case "essentialShare":
      inputs = [essentialInput, inp("monthlyIncome", h.monthlyIncome, "inrMonthly", "monthlyIncome")];
      break;
    case "emergencyMonths":
      inputs = [inp("liquidAssets", h.liquidAssets, "inr", "liquidAssets"), essentialInput];
      break;
    case "emiToIncome":
      inputs = [inp("monthlyEmi", h.monthlyEmi, "inrMonthly", "monthlyEmi"), inp("monthlyIncome", h.monthlyIncome, "inrMonthly", "monthlyIncome")];
      break;
    case "highCostDebtShare":
      inputs = [inp("highCostDebt", h.highCostDebt, "inr"), inp("totalDebt", h.totalDebt, "inr")];
      break;
    case "lifeCoverMultiple":
      inputs = [inp("lifeCover", h.lifeCover, "inr", "lifeCover"), inp("monthlyIncome", h.monthlyIncome, "inrMonthly", "monthlyIncome")];
      assumptions = [{ key: "termCoverMultiple", value: pack.insurance.termCoverMultipleOfIncome.min, kind: "multiple" }];
      break;
    case "healthCoverRatio": {
      const tiers = pack.insurance.healthCoverByCityTier;
      const target = tiers[`tier${h.cityTier}`] ?? tiers.tier1;
      inputs = [inp("healthCover", h.healthCover, "inr", "healthCover"), inp("cityTier", h.cityTier, "count", "cityTier")];
      assumptions = [{ key: "healthCoverTarget", value: target, kind: "inr" }];
      break;
    }
    case "allocationDrift":
    case "equityShare":
    case "targetEquity": {
      const equityShare = financial > 0 ? inv.equity / financial : 0;
      const dim = pack.scoring.dimensions.find((d) => d.key === "investments");
      const eq = dim?.targetEquityByAge ?? { min: 0.3, max: 0.8 };
      const targetEquity = Math.min(eq.max, Math.max(eq.min, (100 - h.age) / 100));
      inputs = [inp("equityShare", equityShare, "percent"), inp("targetEquity", targetEquity, "percent"), inp("age", h.age, "years", "age"), inp("financialAssets", financial, "inr")];
      assumptions = [pct("targetEquityMin", eq.min), pct("targetEquityMax", eq.max)];
      break;
    }
    case "idleCashShare":
      inputs = [inp("liquidAssets", h.liquidAssets, "inr", "liquidAssets"), essentialInput, inp("financialAssets", financial, "inr")];
      break;
    case "retirementReadiness":
    case "projectedCorpus":
    case "corpusNeeded":
      inputs = [
        inp("age", h.age, "years", "age"),
        inp("retirementAge", retireAt, "years", "retirementAge"),
        inp("monthlyExpenses", h.monthlyExpenses, "inrMonthly", "monthlyExpenses"),
        inp("retirementCorpus", h.retirementCorpus, "inr", "retirementCorpus"),
        inp("investments", inv.equity + inv.debt, "inr", "investments"),
        inp("monthlyRetirementSip", h.monthlyRetirementSip ?? 0, "inrMonthly", "monthlyRetirementSip"),
      ];
      assumptions = [pct("inflationGeneral", a.inflationGeneral), pct("returnBalanced", a.returnBalanced), pct("returnPostRetirement", a.returnPostRetirement), { key: "lifeExpectancy", value: a.lifeExpectancy, kind: "age" }];
      break;
    case "goalReadiness":
      inputs = [inp("goals", h.goals?.length ?? 0, "count", "goals")];
      assumptions = [pct("inflationGeneral", a.inflationGeneral), pct("returnBalanced", a.returnBalanced)];
      break;
    case "nominationsSet":
      inputs = [inp("nominationsSet", h.nominationsSet ? 1 : 0, "bool", "nominationsSet")];
      break;
    case "willInPlace":
      inputs = [inp("age", h.age, "years", "age"), inp("dependants", h.dependants, "count", "dependants")];
      break;
    default:
      return undefined;
  }
  const estimatedSet = new Set(h.estimated ?? []);
  // Essentials are a share of expenses, so they inherit the expenses flag.
  const estimated = inputs.map((i) => (i.field === "monthlyEssentialExpenses" ? "monthlyExpenses" : i.field)).filter((f) => estimatedSet.has(f));
  return { metric, inputs, assumptions, estimated: [...new Set(estimated)] };
}

/** Metrics a plan item's rule reads, by matching metric names in the rule text. */
export function metricsInRule(item: Pick<PlanItem, "rule">): string[] {
  return [...new Set(item.rule.match(/[a-z][A-Za-z]+/g) ?? [])].filter((w) => METRIC_NAMES.has(w));
}

const METRIC_NAMES = new Set([
  "savingsRate", "essentialShare", "emergencyMonths", "emiToIncome", "highCostDebtShare", "lifeCoverMultiple", "healthCoverRatio",
  "allocationDrift", "idleCashShare", "targetEquity", "equityShare", "investedShare", "retirementReadiness", "corpusNeeded", "projectedCorpus",
  "goalReadiness", "nominationsSet", "willInPlace",
]);

export type ItemTrace = {
  metrics: { name: string; value: number }[];
  /** "estimates" when any input the rule read is an estimate, "entered" otherwise, "defaults" when the rule read nothing from the member. */
  basis: "entered" | "estimates" | "defaults";
  estimatedFields: string[];
};

/** The numbers behind one plan item and whether they are solid, for the "why this is here" block. */
export function traceItem(item: Pick<PlanItem, "rule" | "dimension">, metrics: Record<string, number>, h: HouseholdSnapshot, pack: RulePack = getRulePack()): ItemTrace {
  const names = metricsInRule(item);
  const used = names.filter((n) => n in metrics).map((n) => ({ name: n, value: metrics[n] }));
  const estimatedFields = new Set<string>();
  let readAnything = false;
  for (const n of names) {
    const t = traceMetric(n, h, pack);
    if (!t) continue;
    if (t.inputs.some((i) => !i.defaulted)) readAnything = true;
    for (const f of t.estimated) estimatedFields.add(f);
  }
  return { metrics: used, basis: estimatedFields.size ? "estimates" : readAnything ? "entered" : "defaults", estimatedFields: [...estimatedFields] };
}
