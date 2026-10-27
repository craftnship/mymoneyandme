import { describe, expect, it } from "vitest";
import { CURRENT_RULEPACK_VERSION, getRulePack, resolvePlaceholders, RULEPACK_VERSIONS, sourceFor } from "./index";

describe("rule pack", () => {
  it("validates and loads the current India pack", () => {
    const p = getRulePack();
    expect(p.country).toBe("IN");
    expect(p.scoring.dimensions).toHaveLength(8);
  });
  it("is the pack for the financial year we are in", () => {
    const p = getRulePack();
    expect(CURRENT_RULEPACK_VERSION).toBe("india-2026-27.v1");
    expect(p.financialYear).toBe("2026-27");
    expect(p.effectiveFrom).toBe("2026-04-01");
    expect(p.reviewedOn).toBeDefined();
  });
  it("keeps older packs so stored check-ups can be re-read", () => {
    expect(RULEPACK_VERSIONS).toContain("india-2025-26.v1");
    expect(getRulePack("india-2025-26.v1").financialYear).toBe("2025-26");
  });
  it("rejects unknown versions", () => {
    expect(() => getRulePack("india-1999.v0")).toThrow();
  });
  it("has a dated source for every tax figure and every scheme", () => {
    const p = getRulePack();
    for (const key of ["tax.newRegime.slabs", "tax.newRegime.standardDeduction", "tax.newRegime.rebate87A", "tax.oldRegime", "tax.cess", "tax.capitalGains", "assumptions", "insurance"]) {
      expect(sourceFor(key, p), key).toBeDefined();
    }
    for (const scheme of Object.keys(p.schemes)) expect(sourceFor(`schemes.${scheme}.rate`, p), scheme).toBeDefined();
    for (const s of Object.values(p.sources ?? {})) expect(s.verifiedOn <= new Date().toISOString().slice(0, 10)).toBe(true);
  });
  it("falls back from a figure to its parent source and reports nothing for unknown paths", () => {
    expect(sourceFor("schemes.ppf.rate")?.url).toContain("dea.gov.in");
    expect(sourceFor("nothing.here")).toBeUndefined();
  });
  it("resolves content placeholders and leaves unknown ones visible", () => {
    expect(resolvePlaceholders("Limit is {section_80c_limit}.")).toBe("Limit is ₹1,50,000.");
    expect(resolvePlaceholders("PPF pays {ppf_rate}.")).toBe("PPF pays 7.1%.");
    expect(resolvePlaceholders("Year {financial_year}.")).toBe("Year 2026-27.");
    expect(resolvePlaceholders("{not_a_key}")).toBe("{not_a_key}");
  });
});
