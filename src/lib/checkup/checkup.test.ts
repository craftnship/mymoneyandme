import { describe, expect, it } from "vitest";
import { runCheckUp, runQuickCheck, type HouseholdSnapshot } from "./engine";
import { buildPlan } from "./plan";
import { getRulePack } from "../rulepack";

const healthy: HouseholdSnapshot = {
  age: 35,
  employment: "salaried",
  dependants: 2,
  cityTier: 1,
  monthlyIncome: 200000,
  monthlyExpenses: 120000,
  monthlyEssentialExpenses: 80000,
  liquidAssets: 600000,
  investments: { equity: 3000000, debt: 1500000, gold: 300000, realEstate: 0 },
  retirementCorpus: 2500000,
  monthlyEmi: 30000,
  highCostDebt: 0,
  totalDebt: 3000000,
  lifeCover: 30000000,
  healthCover: 1500000,
  monthlyRetirementSip: 40000,
  nominationsSet: true,
  willInPlace: true,
  goals: [{ targetToday: 2500000, years: 15, assigned: 500000, monthlySip: 10000 }],
};

describe("check-up engine", () => {
  it("scores a healthy household as good or better", () => {
    const r = runCheckUp(healthy);
    expect(r.overall).toBeGreaterThanOrEqual(70);
    expect(["excellent", "good"]).toContain(r.grade);
    expect(r.dimensions).toHaveLength(8);
    expect(r.rulePackVersion).toBe(getRulePack().version);
  });
  it("weights sum to the pack's total before life-stage adjustment", () => {
    const pack = getRulePack();
    expect(pack.scoring.dimensions.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });
  it("flags a stretched household and orders the plan by priority", () => {
    const stretched: HouseholdSnapshot = {
      ...healthy,
      monthlyIncome: 80000,
      monthlyExpenses: 85000,
      liquidAssets: 20000,
      investments: { equity: 0, debt: 0, gold: 200000, realEstate: 0 },
      retirementCorpus: 100000,
      monthlyEmi: 35000,
      highCostDebt: 300000,
      totalDebt: 2000000,
      lifeCover: 0,
      healthCover: 0,
      monthlyRetirementSip: 0,
      nominationsSet: false,
      willInPlace: false,
    };
    const r = runCheckUp(stretched);
    expect(r.overall).toBeLessThan(50);
    expect(r.grade).toBe("needsAttention");
    const plan = buildPlan(r, stretched.monthlyIncome);
    expect(plan[0].priority).toBe(1);
    for (let i = 1; i < plan.length; i++) expect(plan[i].priority).toBeGreaterThanOrEqual(plan[i - 1].priority);
    expect(plan.map((p) => p.id)).toContain("raise-term-cover");
    expect(plan.map((p) => p.id)).toContain("build-emergency-fund");
    expect(plan[plan.length - 1].id).toBe("annual-review");
  });
  it("raises the retirement weight for pre-retirees", () => {
    const r = runCheckUp({ ...healthy, age: 55 });
    expect(r.lifeStage).toBe("preRetirement");
    expect(r.dimensions.find((d) => d.key === "retirement")!.weight).toBe(20);
  });
  it("quick check returns a low-confidence approximate score", () => {
    const r = runQuickCheck({ age: 30, monthlyIncome: 100000, monthlyExpenses: 60000, emergencySavings: 300000, monthlyEmi: 10000, hasTermCover: true, hasHealthCover: true });
    expect(r.confidence).toBe("low");
    expect(r.overall).toBeGreaterThan(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });
});
