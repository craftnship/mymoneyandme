import { describe, expect, it } from "vitest";
import { dataQuality, qualityHref } from "./quality";
import type { Family } from "./model";

const NOW = new Date("2026-10-26T00:00:00Z");
let n = 0;
const item = (family: Family, type: string, payload: Record<string, unknown>, extra: { memberId?: string | null; updatedAt?: Date } = {}) => ({
  id: `i${++n}`,
  family,
  type,
  memberId: extra.memberId ?? null,
  payload,
  updatedAt: extra.updatedAt ?? NOW,
});

describe("data quality", () => {
  it("is quiet for clean data", () => {
    expect(dataQuality([
      item("income", "salary", { netMonthly: 80000 }),
      item("expenses", "housing", { monthly: 20000 }),
      item("assets", "cash", { currentValue: 100000, valuationDate: "2026-09-01" }),
      item("loans", "home", { outstanding: 2000000, emi: 25000 }),
    ], NOW)).toEqual([]);
  });

  it("flags valuations older than twelve months, by valuation date or last save", () => {
    const issues = dataQuality([
      item("assets", "realEstateSelf", { currentValue: 5000000, valuationDate: "2024-03-01" }),
      item("investments", "stocks", { currentValue: 200000 }, { updatedAt: new Date("2025-06-01T00:00:00Z") }),
      item("investments", "stocks", { currentValue: 200000, label: "Recent" }, { updatedAt: new Date("2026-08-01T00:00:00Z") }),
    ], NOW);
    expect(issues.map((i) => i.kind)).toEqual(["stale", "stale"]);
    expect(issues[0]).toMatchObject({ kind: "stale", months: 31 });
  });

  it("flags likely duplicates but not two different items of the same type", () => {
    const issues = dataQuality([
      item("expenses", "food", { monthly: 12000, label: "Groceries" }),
      item("expenses", "food", { monthly: 12000, label: "groceries " }),
      item("expenses", "food", { monthly: 4000, label: "Eating out" }),
    ], NOW);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "duplicate", amount: 12000, label: "Groceries" });
    expect((issues[0] as { ids: string[] }).ids).toHaveLength(2);
    expect(qualityHref(issues[0])).toBe("/app/data/expenses");
  });

  it("flags zero amounts, loans without an EMI and ended policies, and sorts the most important first", () => {
    const issues = dataQuality([
      item("assets", "gold", { currentValue: 0, valuationDate: "2020-01-01" }),
      item("loans", "car", { outstanding: 300000, emi: 0 }),
      item("loans", "creditCard", { outstanding: 30000, emi: 0 }),
      item("insurance", "termLife", { sumAssured: 10000000, endDate: "2026-01-01" }),
      item("income", "salary", { netMonthly: 50000, endDate: "2099-01-01" }),
    ], NOW);
    expect(issues.map((i) => i.kind)).toEqual(["zero", "loanNoEmi", "ended", "stale"]);
    expect(qualityHref(issues[1])).toMatch(/^\/app\/data\/loans\/i/);
  });
});
