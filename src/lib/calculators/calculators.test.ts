import { describe, expect, it } from "vitest";
import { CALCULATORS, getCalculator, resolveDefaults, runCalculator } from "./index";
import { FORMULAS } from "./formulas";
import { amortisation, emi, fvLumpsum, fvSip, pvGrowingAnnuity, sipForTarget, tenureForEmi, xirr } from "./math";
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

describe("finance maths edge cases", () => {
  it("handles a zero rate without dividing by zero", () => {
    expect(fvSip(1000, 0, 12)).toBe(12000);
    expect(sipForTarget(12000, 0, 12)).toBe(1000);
    expect(emi(120000, 0, 12)).toBe(10000);
    expect(tenureForEmi(120000, 0, 10000)).toBe(12);
    expect(fvLumpsum(1000, 0, 10)).toBe(1000);
    expect(pvGrowingAnnuity(1000, 0.06, 0.06, 10)).toBe(10000);
  });
  it("handles zero and very short horizons", () => {
    expect(fvSip(1000, 0.12, 0)).toBe(0);
    expect(pvGrowingAnnuity(1000, 0.07, 0.06, 0)).toBe(0);
    expect(amortisation(100000, 0.1, 1).months).toBe(1);
  });
  it("reports an EMI that never repays the loan as infinite tenure", () => {
    expect(tenureForEmi(1000000, 0.12, 5000)).toBe(Infinity);
  });
  it("keeps a 40-year horizon finite", () => {
    expect(Number.isFinite(fvSip(10000, 0.12, 480))).toBe(true);
    expect(fvSip(10000, 0.12, 480)).toBeGreaterThan(1e8);
  });
  it("amortisation with an extra payment finishes earlier and pays less interest", () => {
    const base = amortisation(1000000, 0.09, 120);
    const extra = amortisation(1000000, 0.09, 120, 5000);
    expect(extra.months).toBeLessThan(base.months);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
    expect(base.rows[base.rows.length - 1].balance).toBeCloseTo(0, 4);
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
  it("new regime: ₹7 L salary pays nothing and ₹12.75 L salary pays nothing", () => {
    expect(computeRegime(pack, "new", 700000, 0).totalTax).toBe(0);
    expect(computeRegime(pack, "new", 1275000, 0).totalTax).toBe(0);
  });
  it("new regime: ₹12.76 L salary owes tax once the rebate is lost", () => {
    // taxable 12,01,000 → 20k + 40k + 150 = 60,150; above the rebate limit so no rebate
    expect(Math.round(computeRegime(pack, "new", 1276000, 0).slabTax)).toBe(60150);
    expect(computeRegime(pack, "new", 1276000, 0).rebate).toBe(0);
  });
  it("caps the new-regime surcharge at 25% while the old regime reaches 37%", () => {
    const high = 60000000;
    expect(computeRegime(pack, "new", high, 0).surcharge / (computeRegime(pack, "new", high, 0).slabTax)).toBeCloseTo(0.25, 6);
    expect(computeRegime(pack, "old", high, 0).surcharge / (computeRegime(pack, "old", high, 0).slabTax)).toBeCloseTo(0.37, 6);
  });
  it("never returns negative tax or taxable income", () => {
    const r = computeRegime(pack, "old", 30000, 500000);
    expect(r.taxableIncome).toBe(0);
    expect(r.totalTax).toBe(0);
  });
  it("scores the same ₹20 L salary identically under the 2025-26 pack", () => {
    expect(Math.round(computeRegime(getRulePack("india-2025-26.v1"), "new", 2000000, 0).totalTax)).toBe(192400);
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
