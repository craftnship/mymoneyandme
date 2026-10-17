import { describe, expect, it } from "vitest";
import { CALCULATORS, getCalculator, resolveDefaults, runCalculator } from "./index";
import { FORMULAS } from "./formulas";
import { emi, fvLumpsum, fvSip, xirr } from "./math";
import { getRulePack } from "../rulepack";
import { computeRegime, hraExemption } from "./tax";

/**
 * Reference cases (section 17: calculators reproduce published reference results).
 * Values are the widely published figures for these inputs.
 */
describe("finance maths", () => {
  it("SIP of ₹5,000 at 12% for 10 years ≈ ₹11.6 L", () => {
    expect(Math.round(fvSip(5000, 0.12, 120))).toBe(1161695);
  });
  it("EMI on ₹50 L at 8.5% for 20 years ≈ ₹43,391", () => {
    expect(Math.round(emi(5000000, 0.085, 240))).toBe(43391);
  });
  it("FD of ₹1 L at 7% for 5 years, quarterly compounding ≈ ₹1,41,478", () => {
    expect(Math.round(fvLumpsum(100000, 0.07, 5, 4))).toBe(141478);
  });
  it("XIRR of a flat 12 month SIP ending at 10% gain is positive and sensible", () => {
    const now = Date.UTC(2026, 0, 1);
    const flows = Array.from({ length: 12 }, (_, k) => ({ date: Date.UTC(2025, k, 1), amount: -1000 }));
    flows.push({ date: now, amount: 13200 });
    const r = xirr(flows);
    expect(r).toBeGreaterThan(0.15);
    expect(r).toBeLessThan(0.25);
  });
});

describe("India tax rules", () => {
  const pack = getRulePack();
  it("new regime: ₹12 L salary pays nothing after rebate and standard deduction", () => {
    expect(computeRegime(pack, "new", 1200000, 0).totalTax).toBe(0);
  });
  it("new regime: ₹20 L salary", () => {
    // taxable 19.25 L → 0 + 20k + 40k + 60k + 65k = 1,85,000 + 4% cess = 1,92,400
    expect(Math.round(computeRegime(pack, "new", 2000000, 0).totalTax)).toBe(192400);
  });
  it("old regime: ₹10 L with 1.5 L under 80C", () => {
    // taxable 8 L → 12,500 + 60,000 = 72,500 + cess = 75,400
    expect(Math.round(computeRegime(pack, "old", 1000000, 150000).totalTax)).toBe(75400);
  });
  it("HRA exemption is the least of the three statutory amounts", () => {
    expect(hraExemption(600000, 240000, 300000, true)).toBe(240000);
    expect(hraExemption(600000, 240000, 150000, true)).toBe(90000);
  });
});

describe("calculator registry", () => {
  it("has a formula family for every definition", () => {
    for (const c of CALCULATORS) expect(FORMULAS[c.formula], c.slug).toBeTypeOf("function");
  });
  it("has unique slugs and at least the 46 calculators in the catalogue", () => {
    const slugs = new Set(CALCULATORS.map((c) => c.slug));
    expect(slugs.size).toBe(CALCULATORS.length);
    expect(CALCULATORS.length).toBeGreaterThanOrEqual(46);
  });
  it("every calculator runs on its defaults and returns every declared output", () => {
    for (const c of CALCULATORS) {
      const r = runCalculator(c.slug);
      for (const o of c.outputs) {
        const v = r.values[o.key];
        expect(v, `${c.slug}.${o.key}`).toBeDefined();
        if (typeof v === "number") expect(Number.isNaN(v), `${c.slug}.${o.key}`).toBe(false);
      }
      expect(r.rulePackVersion).toBe(getRulePack().version);
    }
  });
  it("resolves rule-pack references in defaults", () => {
    const d = resolveDefaults(getCalculator("sip")!);
    expect(d.rate).toBe(getRulePack().assumptions.returnEquity);
  });
  it("clamps out-of-range inputs", () => {
    const r = runCalculator("sip", { years: 500 });
    expect(r.inputs.years).toBe(40);
  });
  it("retirement corpus closes the gap with a SIP", () => {
    const r = runCalculator("retirement-corpus", { age: 30, retirementAge: 60, monthlyExpense: 50000, existingCorpus: 0 });
    expect(r.values.corpusNeeded).toBeGreaterThan(1e7);
    expect(r.values.monthlySip).toBeGreaterThan(0);
  });
  it("income tax picks the cheaper regime", () => {
    const r = runCalculator("income-tax", { income: 1500000, deductions80C: 150000, deductions80D: 25000, npsExtra: 50000, homeLoanInterest: 200000 });
    expect(["new", "old"]).toContain(r.values.betterRegime);
    expect(r.values.saving).toBe(Math.abs(Number(r.values.taxNew) - Number(r.values.taxOld)));
  });
});
