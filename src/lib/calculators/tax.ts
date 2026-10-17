import type { RulePack, TaxSlab } from "../rulepack/schema";

export function taxOnSlabs(taxable: number, slabs: TaxSlab[]) {
  let tax = 0;
  let lower = 0;
  for (const slab of slabs) {
    const upper = slab.upTo ?? Infinity;
    if (taxable > lower) {
      tax += (Math.min(taxable, upper) - lower) * slab.rate;
    }
    lower = upper;
    if (taxable <= upper) break;
  }
  return tax;
}

export type RegimeResult = {
  taxableIncome: number;
  slabTax: number;
  rebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
};

export function computeRegime(
  pack: RulePack,
  regime: "new" | "old",
  grossIncome: number,
  deductions: number, // chapter VI-A and 24(b), only honoured under the old regime
): RegimeResult {
  const cfg = regime === "new" ? pack.tax.newRegime : pack.tax.oldRegime;
  const allowed = regime === "new" ? 0 : deductions;
  const taxableIncome = Math.max(0, grossIncome - cfg.standardDeduction - allowed);
  const slabTax = taxOnSlabs(taxableIncome, cfg.slabs);
  // Section 87A: full rebate when taxable income is within the limit.
  const rebate =
    taxableIncome <= cfg.rebate87A.incomeLimit ? Math.min(slabTax, cfg.rebate87A.maxRebate) : 0;
  const afterRebate = slabTax - rebate;
  let surchargeRate = 0;
  for (const s of pack.tax.surcharge) if (taxableIncome > s.above) surchargeRate = s.rate;
  const surcharge = afterRebate * surchargeRate;
  const cess = (afterRebate + surcharge) * pack.tax.cess;
  return {
    taxableIncome,
    slabTax,
    rebate,
    surcharge,
    cess,
    totalTax: afterRebate + surcharge + cess,
  };
}

/** HRA exemption under section 10(13A): least of the three statutory amounts. */
export function hraExemption(basicPlusDA: number, hraReceived: number, rentPaid: number, metro: boolean) {
  const a = hraReceived;
  const b = Math.max(0, rentPaid - 0.1 * basicPlusDA);
  const c = (metro ? 0.5 : 0.4) * basicPlusDA;
  return Math.max(0, Math.min(a, b, c));
}
