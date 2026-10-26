import { describe, expect, it } from "vitest";
import { metricsInRule, traceItem, traceMetric } from "./trace";
import { runCheckUp, type HouseholdSnapshot } from "./engine";
import { buildPlan } from "./plan";

const base: HouseholdSnapshot = {
  age: 34,
  employment: "salaried",
  dependants: 1,
  cityTier: 1,
  monthlyIncome: 100000,
  monthlyExpenses: 70000,
  monthlyEssentialExpenses: 50000,
  liquidAssets: 100000,
  investments: { equity: 300000, debt: 100000, gold: 0, realEstate: 0 },
  retirementCorpus: 200000,
  monthlyEmi: 15000,
  highCostDebt: 50000,
  totalDebt: 500000,
  lifeCover: 2000000,
  healthCover: 500000,
  provided: ["monthlyIncome", "monthlyExpenses", "liquidAssets", "lifeCover", "healthCover", "monthlyEmi", "investments", "retirementCorpus", "age"],
  estimated: ["monthlyExpenses"],
};

describe("metric traces", () => {
  it("lists the inputs and assumptions behind every scored metric", () => {
    const result = runCheckUp(base);
    for (const d of result.dimensions) {
      for (const name of Object.keys(d.metrics)) {
        const t = traceMetric(name, base);
        expect(t, name).toBeDefined();
        expect(t!.inputs.length, name).toBeGreaterThan(0);
      }
    }
  });
  it("marks inputs the member never entered as defaults", () => {
    const t = traceMetric("retirementReadiness", base)!;
    expect(t.inputs.find((i) => i.field === "retirementAge")).toMatchObject({ value: 60, defaulted: true });
    expect(t.inputs.find((i) => i.field === "age")).toMatchObject({ value: 34, defaulted: false });
    expect(t.assumptions.map((a) => a.key)).toEqual(["inflationGeneral", "returnBalanced", "returnPostRetirement", "lifeExpectancy"]);
  });
  it("carries the estimate flag from the snapshot to the metrics that read the field", () => {
    expect(traceMetric("savingsRate", base)!.estimated).toEqual(["monthlyExpenses"]);
    expect(traceMetric("emiToIncome", base)!.estimated).toEqual([]);
    expect(traceMetric("emergencyMonths", base)!.inputs[1]).toMatchObject({ field: "monthlyEssentialExpenses", defaulted: false });
  });
  it("uses 60% of expenses as essentials when they were not split", () => {
    const t = traceMetric("emergencyMonths", { ...base, monthlyEssentialExpenses: undefined })!;
    expect(t.inputs[1]).toMatchObject({ value: 42000, defaulted: true });
  });
  it("returns nothing for an unknown metric", () => {
    expect(traceMetric("nope", base)).toBeUndefined();
  });
});

describe("plan item traces", () => {
  it("finds the metrics a rule reads", () => {
    expect(metricsInRule({ rule: "allocationDrift > 0.10 and investedShare = 0" })).toEqual(["allocationDrift", "investedShare"]);
    expect(metricsInRule({ rule: "always" })).toEqual([]);
  });
  it("says whether an item rests on entered figures, estimates or defaults", () => {
    const result = runCheckUp(base);
    const plan = buildPlan(result, base.monthlyIncome);
    const byId = Object.fromEntries(plan.map((p) => [p.id, p]));
    expect(traceItem(byId["clear-high-cost-debt"], result.metrics, base).basis).toBe("entered");
    const fund = traceItem(byId["build-emergency-fund"], result.metrics, base);
    expect(fund.basis).toBe("estimates");
    expect(fund.estimatedFields).toEqual(["monthlyExpenses"]);
    expect(fund.metrics).toEqual([{ name: "emergencyMonths", value: result.metrics.emergencyMonths }]);
    expect(traceItem(byId["annual-review"], result.metrics, base).basis).toBe("defaults");
  });
});
