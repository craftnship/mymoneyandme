import { describe, expect, it } from "vitest";
import { runCheckUp, runQuickCheck, type HouseholdSnapshot } from "./engine";
import { buildPlan } from "./plan";
import { getRulePack } from "../rulepack";
import { explainItem } from "./explain";
import { runCalculator } from "../calculators";

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

describe("missing data is unknown, not zero", () => {
  // Only income, expenses and bank savings entered: the member-app first look.
  const firstLook: HouseholdSnapshot = {
    age: 38,
    employment: "salaried",
    dependants: 2,
    cityTier: 1,
    monthlyIncome: 100000,
    monthlyExpenses: 60000,
    liquidAssets: 300000,
    investments: { equity: 0, debt: 0, gold: 0, realEstate: 0, other: 0 },
    retirementCorpus: 0,
    monthlyEmi: 0,
    highCostDebt: 0,
    totalDebt: 0,
    lifeCover: 0,
    healthCover: 0,
    monthlyRetirementSip: 0,
    provided: ["monthlyIncome", "monthlyExpenses", "liquidAssets", "age", "employment", "cityTier", "dependants"],
  };
  const status = (r: ReturnType<typeof runCheckUp>, k: string) => r.dimensions.find((d) => d.key === k)!.status;

  it("does not score goals as 100 when there are no goals", () => {
    const r = runCheckUp(firstLook);
    expect(status(r, "goals")).toBe("unknown");
    expect(r.strengths).not.toContain("goals");
    expect(r.risks).not.toContain("goals");
  });
  it("does not score hygiene as Good from the under-40 will exemption alone", () => {
    const r = runCheckUp({ ...firstLook, age: 30, dependants: 0 });
    expect(status(r, "hygiene")).toBe("unknown");
    expect(r.strengths).not.toContain("hygiene");
  });
  it("scores hygiene once the will question is answered", () => {
    const r = runCheckUp({ ...firstLook, age: 30, dependants: 0, willInPlace: false, nominationsSet: true });
    expect(status(r, "hygiene")).not.toBe("unknown");
  });
  it("leaves unentered insurance, retirement and nominations unscored instead of Act · 0", () => {
    const r = runCheckUp(firstLook);
    for (const k of ["insurance", "retirement", "hygiene"]) expect(status(r, k)).toBe("unknown");
    for (const k of ["insurance", "retirement", "hygiene"]) expect(r.risks).not.toContain(k);
  });
  it("computes the overall score from scored dimensions only", () => {
    const r = runCheckUp(firstLook);
    const scored = r.dimensions.filter((d) => d.status !== "unknown");
    const w = scored.reduce((s, d) => s + d.weight, 0);
    expect(r.overall).toBe(Math.round(scored.reduce((s, d) => s + d.score * d.weight, 0) / w));
  });
  it("does not lower the score when a strong area is added", () => {
    const before = runCheckUp(firstLook).overall;
    const after = runCheckUp({ ...firstLook, lifeCover: 15000000, healthCover: 1500000, provided: [...firstLook.provided!, "lifeCover", "healthCover"] }).overall;
    expect(after).toBeGreaterThanOrEqual(before);
  });
  it("scores a partly known dimension on the known part only", () => {
    const r = runCheckUp({ ...firstLook, healthCover: 1000000, provided: [...firstLook.provided!, "healthCover"] });
    const ins = r.dimensions.find((d) => d.key === "insurance")!;
    expect(ins.score).toBe(100);
    expect(Object.keys(ins.metrics)).toEqual(["healthCoverRatio"]);
  });
  it("says start investing, not rebalance, when nothing is invested", () => {
    const ids = buildPlan(runCheckUp(firstLook), firstLook.monthlyIncome).map((p) => p.id);
    expect(ids).toContain("start-investing");
    expect(ids).not.toContain("rebalance");
  });
  it("still says rebalance when a portfolio exists but has drifted", () => {
    const h = { ...firstLook, investments: { equity: 0, debt: 2000000, gold: 0, realEstate: 0, other: 0 }, provided: [...firstLook.provided!, "investments"] };
    const ids = buildPlan(runCheckUp(h), h.monthlyIncome).map((p) => p.id);
    expect(ids).toContain("rebalance");
    expect(ids).not.toContain("start-investing");
  });
  it("builds no advice on numbers that were not entered, and asks for them instead", () => {
    const ids = buildPlan(runCheckUp(firstLook), firstLook.monthlyIncome).map((p) => p.id);
    for (const id of ["raise-term-cover", "raise-health-cover", "retirement-sip", "fund-goals"]) expect(ids).not.toContain(id);
    expect(ids).toContain("fill-gaps");
    expect(ids[ids.length - 1]).toBe("annual-review");
  });
  it("keeps the will and nominations checklist items when their status is unknown", () => {
    const ids = buildPlan(runCheckUp(firstLook), firstLook.monthlyIncome).map((p) => p.id);
    expect(ids).toContain("set-nominations");
    expect(ids).toContain("write-will");
  });
  it("quick check leaves what it does not ask about unscored", () => {
    const r = runQuickCheck({ age: 30, monthlyIncome: 100000, monthlyExpenses: 60000, emergencySavings: 300000, monthlyEmi: 10000, hasTermCover: true, hasHealthCover: true });
    for (const k of ["goals", "hygiene", "retirement"]) expect(status(r, k)).toBe("unknown");
    for (const k of ["cashflow", "emergency", "debt", "insurance"]) expect(status(r, k)).not.toBe("unknown");
  });
  it("keeps legacy snapshots without a provided list fully scored", () => {
    const r = runCheckUp(healthy);
    expect(r.dimensions.every((d) => d.status !== "unknown")).toBe(true);
  });
});

describe("explaining the big numbers", () => {
  it("opens the retirement calculator on the same numbers the plan used", () => {
    const h: HouseholdSnapshot = { ...healthy, monthlyRetirementSip: 0, retirementCorpus: 0, investments: { equity: 0, debt: 0, gold: 0, realEstate: 0 } };
    const r = runCheckUp(h);
    const item = buildPlan(r, h.monthlyIncome).find((i) => i.id === "retirement-sip")!;
    const e = explainItem(item, h, r.rulePackVersion)!;
    expect(e.template).toBe("retirementSip");
    expect(e.params).toMatchObject({ retireAt: 60, lifeExpectancy: 85, inflation: 6, postReturn: 7, expenses: 120000 });
    expect(Math.round(Number(runCalculator("retirement-corpus", e.calculatorInputs).values.corpusNeeded))).toBe(Number(item.params.corpus));
  });
  it("explains term and health cover targets and leaves other items alone", () => {
    const h: HouseholdSnapshot = { ...healthy, lifeCover: 0, healthCover: 200000, cityTier: 2 };
    const r = runCheckUp(h);
    const plan = buildPlan(r, h.monthlyIncome);
    const term = explainItem(plan.find((i) => i.id === "raise-term-cover")!, h)!;
    expect(term.params).toEqual({ multiple: 10, annual: 2400000 });
    expect(term.calculatorInputs).toMatchObject({ income: 200000, existingCover: 0, loans: 3000000 });
    const health = explainItem(plan.find((i) => i.id === "raise-health-cover")!, h)!;
    expect(health.params).toEqual({ target: 700000, tier: 2 });
    expect(explainItem(plan.find((i) => i.id === "annual-review")!, h)).toBeUndefined();
  });
});
