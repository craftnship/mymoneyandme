import type { HouseholdSnapshot } from "./engine";
import type { PlanItem } from "./plan";
import { getRulePack } from "../rulepack";

/**
 * One line on what a plan item's big number assumes, plus the inputs that
 * open its calculator on the member's own numbers. Only items that quote a
 * corpus or a cover target have one. Pure, so it can be unit-tested and the
 * calculator shows the same figure as the plan.
 */
export type ItemExplanation = {
  template: "retirementSip" | "raiseTermCover" | "raiseHealthCover"; // message key under plan.assumes
  params: Record<string, number>;
  calculatorInputs: Record<string, number>;
};

const pct = (x: number) => Math.round(x * 1000) / 10;

export function explainItem(item: PlanItem, h: HouseholdSnapshot, rulePackVersion?: string): ItemExplanation | undefined {
  const pack = getRulePack(rulePackVersion);
  const a = pack.assumptions;
  const retireAt = h.retirementAge ?? a.defaultRetirementAge;

  if (item.id === "retirement-sip") return retirementExplanation(h, rulePackVersion);
  if (item.id === "raise-term-cover") {
    const multiple = pack.insurance.termCoverMultipleOfIncome.min;
    return {
      template: "raiseTermCover",
      params: { multiple, annual: Math.round(h.monthlyIncome * 12) },
      calculatorInputs: {
        income: Math.round(h.monthlyIncome),
        age: h.age,
        retirementAge: retireAt,
        loans: Math.round(h.totalDebt),
        goals: Math.round((h.goals ?? []).reduce((s, g) => s + g.targetToday, 0)),
        assets: Math.round(h.liquidAssets),
        existingCover: Math.round(h.lifeCover),
      },
    };
  }
  if (item.id === "raise-health-cover") {
    const tiers = pack.insurance.healthCoverByCityTier;
    const target = h.cityTier === 1 ? tiers.tier1 : h.cityTier === 2 ? tiers.tier2 : tiers.tier3;
    return {
      template: "raiseHealthCover",
      params: { target, tier: h.cityTier },
      calculatorInputs: { members: Math.min(8, h.dependants + 1), cityTier: h.cityTier, age: h.age, existingCover: Math.round(h.healthCover) },
    };
  }
  return undefined;
}

/** The retirement corpus line, shared by the plan item and the check-up's retirement card. */
export function retirementExplanation(h: HouseholdSnapshot, rulePackVersion?: string): ItemExplanation {
  const a = getRulePack(rulePackVersion).assumptions;
  const retireAt = h.retirementAge ?? a.defaultRetirementAge;
  return {
    template: "retirementSip",
    params: { retireAt, lifeExpectancy: a.lifeExpectancy, inflation: pct(a.inflationGeneral), postReturn: pct(a.returnPostRetirement), expenses: Math.round(h.monthlyExpenses) },
    calculatorInputs: {
      age: h.age,
      retirementAge: retireAt,
      lifeExpectancy: a.lifeExpectancy,
      monthlyExpense: Math.round(h.monthlyExpenses),
      inflation: a.inflationGeneral,
      preReturn: a.returnBalanced,
      postReturn: a.returnPostRetirement,
      // Same pool the engine projects: retirement savings plus equity and debt investments.
      existingCorpus: Math.round(h.retirementCorpus + h.investments.equity + h.investments.debt),
    },
  };
}
