import { describe, expect, it } from "vitest";
import { computeMoneySnapshot, netWorthBreakdown, snapshotDelta, type SnapshotInputUser } from "./compute";
import type { FinancialItem } from "../data/model";
import type { Member } from "../data/store";

const now = new Date("2026-10-27T10:00:00Z");
let n = 0;
function item<F extends FinancialItem["family"]>(family: F, type: string, payload: Record<string, unknown>, confidence: FinancialItem["confidence"] = "entered"): FinancialItem {
  n += 1;
  return { id: `id-${n}`, householdId: "h", family, type, memberId: null, payload: { label: "", ...payload } as FinancialItem<F>["payload"], confidence, createdAt: now, updatedAt: new Date("2026-10-20T00:00:00Z") } as FinancialItem;
}

const user: SnapshotInputUser = { dob: "1989-06-15", employment: "salaried", dependants: 2, cityTier: 1, retirementAge: 60, maritalStatus: "married", city: "Chennai", state: "TN", riskProfile: null };
const members: Member[] = [{ id: "m1", householdId: "h", userId: "u", name: "Santa", relation: "self", dob: "1989-06-15", earns: true, dependant: false }];

const household: FinancialItem[] = [
  item("income", "salary", { netMonthly: 120000, frequency: "monthly", taxable: true }),
  item("expenses", "housing", { monthly: 30000, fixed: true, essential: true, inflationLinked: true }),
  item("expenses", "lifestyle", { monthly: 15000, fixed: false, essential: false, inflationLinked: true }),
  item("loans", "home", { outstanding: 3200000, emi: 28000, interestPct: 8.6, monthsLeft: 180, lenderType: "bank", rateType: "floating", prepaymentPenalty: false, insured: false, revolving: false }),
  item("loans", "creditCard", { outstanding: 60000, emi: 0, interestPct: 36, lenderType: "bank", rateType: "floating", prepaymentPenalty: false, insured: false, revolving: true }),
  item("assets", "cash", { currentValue: 150000, liquidity: "liquid" }),
  item("assets", "fixedDeposit", { currentValue: 300000, liquidity: "nearLiquid" }),
  item("assets", "realEstateSelf", { currentValue: 6000000, liquidity: "liquid" }), // "liquid" entered by mistake: must not count as cash
  item("assets", "epf", { currentValue: 900000, liquidity: "illiquid" }),
  item("assets", "gold", { currentValue: 400000, liquidity: "nearLiquid", valuationDate: "2024-02-10" }),
  item("investments", "mutualFundEquity", { currentValue: 650000, sipMonthly: 15000, assetClass: "equity", risk: "high", retirementTagged: false }),
  item("investments", "ulip", { currentValue: 100000, sipMonthly: 0, assetClass: "equity", risk: "medium", retirementTagged: false }),
  item("investments", "bonds", { currentValue: 200000, sipMonthly: 0, assetClass: "debt", risk: "low", retirementTagged: false, lockInUntil: "2028-01-01" }),
];

describe("net worth breakdown", () => {
  const b = netWorthBreakdown(household, now);

  it("adds up assets and liabilities and never counts property or retirement accounts as liquid", () => {
    expect(b.assets).toBe(150000 + 300000 + 6000000 + 900000 + 400000 + 650000 + 100000 + 200000);
    expect(b.liabilities).toBe(3260000);
    expect(b.netWorth).toBe(b.assets - b.liabilities);
    // Liquid: cash, FD, gold, equity MF. Not: home (even if entered as liquid), EPF, ULIP, locked bonds.
    expect(b.liquidAssets).toBe(150000 + 300000 + 400000 + 650000);
    expect(b.illiquidAssets).toBe(b.assets - b.liquidAssets);
  });

  it("subtracts only short-term liabilities from liquid net worth", () => {
    expect(b.shortTermLiabilities).toBe(60000); // the card; the home loan has 180 months left
    expect(b.liquidNetWorth).toBe(1500000 - 60000);
    expect(b.loans[0]).toMatchObject({ type: "home", highCost: false, shortTerm: false });
    expect(b.loans[1]).toMatchObject({ type: "creditCard", highCost: true, shortTerm: true });
  });

  it("groups by how the money behaves and flags concentration", () => {
    expect(b.categories[0].category).toBe("realEstate");
    expect(b.categories.map((c) => c.category)).toEqual(["realEstate", "retirement", "equity", "cash", "gold", "debt"]);
    expect(b.categories.find((c) => c.category === "equity")?.items.map((i) => i.type)).toEqual(["mutualFundEquity", "ulip"]);
    expect(b.categories.find((c) => c.category === "equity")?.liquid).toBe(650000);
    // Real estate is 69% of assets: a category warning; the home itself is exempt from the single-holding rule.
    expect(b.concentration).toEqual([{ kind: "category", category: "realEstate", share: 6000000 / b.assets }]);
  });

  it("flags one holding that dominates, and keeps cash exempt", () => {
    const small = netWorthBreakdown([item("assets", "cash", { currentValue: 100000, liquidity: "liquid" }), item("investments", "stocks", { currentValue: 500000, sipMonthly: 0, assetClass: "equity", risk: "high", retirementTagged: false, label: "One stock" })], now);
    expect(small.concentration.map((c) => c.kind)).toEqual(["category", "item"]);
    const cashOnly = netWorthBreakdown([item("assets", "cash", { currentValue: 100000, liquidity: "liquid" })], now);
    expect(cashOnly.concentration).toEqual([]);
  });

  it("handles no records", () => {
    const empty = netWorthBreakdown([], now);
    expect(empty).toMatchObject({ assets: 0, liabilities: 0, netWorth: 0, liquidNetWorth: 0, categories: [], loans: [], concentration: [] });
  });
});

describe("money snapshot", () => {
  const s = computeMoneySnapshot(user, members, household, [], now);

  it("splits the month into take-home, essential, discretionary, instalments and surplus", () => {
    expect(s.month).toBe("2026-10");
    expect(s.takeHome).toBe(120000);
    expect(s.emis).toBe(28000);
    expect(s.essentialSpend).toBe(30000);
    expect(s.discretionarySpend).toBe(15000);
    expect(s.surplus).toBe(120000 - 30000 - 15000 - 28000);
    expect(s.dataAsOf).toBe("2026-10-20T00:00:00.000Z");
  });

  it("agrees with the net worth view and the check-up engine", () => {
    const b = netWorthBreakdown(household, now);
    expect(s.netWorth).toBe(b.netWorth);
    expect(s.liquidNetWorth).toBe(b.liquidNetWorth);
    expect(s.liabilities).toBe(b.liabilities);
    // Emergency months use the engine's liquid assets (cash, FD, liquid debt funds) over essentials including EMIs.
    expect(s.emergencyMonths).toBeCloseTo(450000 / 58000, 1);
    expect(s.score).toBeGreaterThan(0);
  });

  it("gives six indicators with statuses, marks retirement as a projection and leaves goals unknown without any", () => {
    expect(s.indicators.map((i) => i.key)).toEqual(["emergency", "cashflow", "debt", "goals", "retirement", "data"]);
    const by = Object.fromEntries(s.indicators.map((i) => [i.key, i]));
    expect(by.goals.status).toBe("unknown");
    expect(by.retirement.projected).toBe(true);
    expect(by.cashflow.value).toBeCloseTo(47000 / 120000, 3);
    expect(by.debt.value).toBeCloseTo(28000 / 120000, 3);
    expect(by.data.status).toBe("good");
    expect(s.completeness).toBeGreaterThanOrEqual(80);
  });

  it("lists what changed between two months, largest move first", () => {
    const later = computeMoneySnapshot(user, members, [...household, item("assets", "cash", { currentValue: 50000, liquidity: "liquid" })], [], new Date("2026-11-05T00:00:00Z"));
    const d = snapshotDelta(later, s);
    expect(d[0]).toMatchObject({ key: "assets", change: 50000 });
    expect(d.map((x) => x.key)).toContain("liquidNetWorth");
    expect(d.find((x) => x.key === "takeHome")).toBeUndefined();
    expect(snapshotDelta(s, s)).toEqual([]);
  });

  it("works with nothing but an income", () => {
    const bare = computeMoneySnapshot(user, members, [item("income", "salary", { netMonthly: 50000, frequency: "monthly", taxable: true })], [], now);
    expect(bare.netWorth).toBe(0);
    expect(bare.surplus).toBe(50000);
    expect(bare.indicators.find((i) => i.key === "emergency")?.status).toBe("unknown");
  });
});
