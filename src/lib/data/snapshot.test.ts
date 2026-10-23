import { describe, expect, it } from "vitest";
import { ageFromDob, buildSnapshot, missingFields, type SnapshotUser } from "./snapshot";
import type { FinancialItem, Family, Payload } from "./model";
import type { Member } from "./store";
import type { Goal } from "../goals/model";

const NOW = new Date("2026-10-18T00:00:00Z");
const HH = "hh-1";

let n = 0;
function item<F extends Family>(family: F, type: string, payload: Payload<F>, memberId: string | null = null): FinancialItem<F> {
  n += 1;
  return { id: `i${n}`, householdId: HH, family, type, memberId, payload, confidence: "entered", createdAt: NOW, updatedAt: NOW };
}
function member(id: string, relation: Member["relation"], earns: boolean, dependant: boolean): Member {
  return { id, householdId: HH, userId: null, name: id, relation, dob: null, earns, dependant };
}
function goal(targetToday: number, targetDate: string, monthlySip = 0, assignedAmount = 0): Goal {
  return { id: "g1", householdId: HH, memberId: null, template: "custom", name: "Goal", targetDate, priority: "should", flexibilityYears: 0, payload: { targetToday, inflationPct: 6, assignedAmount, monthlySip }, createdAt: NOW, updatedAt: NOW };
}

const user: SnapshotUser = { dob: "1991-03-15", employment: "salaried", dependants: 1, cityTier: 1, retirementAge: 58 };
const self = member("self", "self", true, false);
const spouse = member("spouse", "spouse", true, false);
const child = member("child", "child", false, true);

describe("ageFromDob", () => {
  it("counts completed years", () => {
    expect(ageFromDob("1991-03-15", NOW)).toBe(35);
    expect(ageFromDob("1991-12-31", NOW)).toBe(34);
    expect(ageFromDob(null, NOW)).toBeNull();
    expect(ageFromDob("not-a-date", NOW)).toBeNull();
  });
});

describe("buildSnapshot", () => {
  it("uses defaults and reports nothing provided but profile fields when there is no data", () => {
    const s = buildSnapshot({ ...user, dob: null, dependants: 0 }, [self], [], [], NOW);
    expect(s.age).toBe(35);
    expect(s.monthlyIncome).toBe(0);
    expect(s.dualIncome).toBe(false);
    expect(s.provided).toEqual(["retirementAge", "employment", "cityTier"]);
    expect(s.monthlyEssentialExpenses).toBeUndefined();
    expect(s.nominationsSet).toBeUndefined();
    expect(s.goals).toBeUndefined();
  });

  it("normalises income frequency and counts earners for dual income", () => {
    const items = [
      item("income", "salary", { label: "", netMonthly: 100000, frequency: "monthly", taxable: true }, "self"),
      item("income", "business", { label: "", netMonthly: 120000, frequency: "quarterly", taxable: true }, "spouse"),
      item("income", "rental", { label: "", netMonthly: 240000, frequency: "yearly", taxable: true }),
    ];
    const s = buildSnapshot(user, [self, spouse, child], items, [], NOW);
    expect(s.monthlyIncome).toBe(100000 + 40000 + 20000);
    expect(s.dualIncome).toBe(true);
    expect(s.dependants).toBe(1);
    expect(s.provided).toContain("monthlyIncome");
    expect(s.provided).toContain("dependants");
  });

  it("adds EMIs to expenses and essentials, and flags high-cost and revolving debt", () => {
    const items = [
      item("expenses", "housing", { label: "", monthly: 30000, fixed: true, essential: true, inflationLinked: true }),
      item("expenses", "lifestyle", { label: "", monthly: 10000, fixed: false, essential: false, inflationLinked: true }),
      item("loans", "home", { label: "", lenderType: "bank", outstanding: 3000000, interestPct: 8.5, rateType: "floating", emi: 25000, prepaymentPenalty: false, insured: false, revolving: false }),
      item("loans", "personal", { label: "", lenderType: "nbfc", outstanding: 200000, interestPct: 18, rateType: "fixed", emi: 7000, prepaymentPenalty: false, insured: false, revolving: false }),
      item("loans", "creditCard", { label: "", lenderType: "bank", outstanding: 50000, interestPct: 0, rateType: "fixed", emi: 0, prepaymentPenalty: false, insured: false, revolving: true }),
    ];
    const s = buildSnapshot(user, [self], items, [], NOW);
    expect(s.monthlyExpenses).toBe(40000 + 32000);
    expect(s.monthlyEssentialExpenses).toBe(30000 + 32000);
    expect(s.monthlyEmi).toBe(32000);
    expect(s.totalDebt).toBe(3250000);
    expect(s.highCostDebt).toBe(250000);
    expect(s.provided).toEqual(expect.arrayContaining(["monthlyExpenses", "monthlyEmi"]));
  });

  it("splits assets and investments into liquid, retirement and asset classes without double counting", () => {
    const items = [
      item("assets", "cash", { label: "", currentValue: 100000, liquidity: "liquid" }),
      item("assets", "fixedDeposit", { label: "", currentValue: 200000, liquidity: "nearLiquid" }),
      item("assets", "fixedDeposit", { label: "", currentValue: 50000, liquidity: "illiquid" }),
      item("assets", "realEstateSelf", { label: "", currentValue: 5000000, liquidity: "illiquid" }),
      item("assets", "gold", { label: "", currentValue: 300000, liquidity: "nearLiquid" }),
      item("assets", "vehicle", { label: "", currentValue: 400000, liquidity: "illiquid" }),
      item("assets", "epf", { label: "", currentValue: 800000, liquidity: "illiquid" }),
      item("investments", "mutualFundEquity", { label: "", currentValue: 1000000, sipMonthly: 10000, assetClass: "equity", risk: "high", retirementTagged: false }),
      item("investments", "mutualFundDebt", { label: "", currentValue: 150000, sipMonthly: 0, assetClass: "debt", risk: "low", retirementTagged: false }),
      item("investments", "bonds", { label: "", currentValue: 250000, sipMonthly: 0, assetClass: "debt", risk: "low", lockInUntil: "2030-01-01", retirementTagged: false }),
      item("investments", "nps", { label: "", currentValue: 500000, sipMonthly: 5000, assetClass: "equity", risk: "medium", retirementTagged: true }),
    ];
    const s = buildSnapshot(user, [self], items, [], NOW);
    expect(s.liquidAssets).toBe(100000 + 200000 + 150000);
    expect(s.investments).toEqual({ equity: 1000000, debt: 250000, gold: 300000, realEstate: 5000000, other: 50000 + 400000 });
    expect(s.retirementCorpus).toBe(800000 + 500000);
    expect(s.monthlyRetirementSip).toBe(5000);
    expect(s.provided).toEqual(expect.arrayContaining(["liquidAssets", "investments", "retirementCorpus", "monthlyRetirementSip"]));
  });

  it("sums life cover and takes the least-covered member for health cover", () => {
    const pol = (type: string, sumAssured: number, coveredMemberIds: string[] = [], memberId: string | null = null, nomineeSet?: boolean) =>
      item("insurance", type, { label: "", insurerType: "private", sumAssured, premium: 0, frequency: "yearly", coveredMemberIds, nomineeSet }, memberId);
    const items = [
      pol("termLife", 10000000, [], "self", true),
      pol("endowment", 500000, [], "self", true),
      pol("healthFloater", 1000000, ["self", "spouse"]),
      pol("healthIndividual", 300000, [], "child"),
      pol("healthEmployer", 500000, ["self"]),
    ];
    const s = buildSnapshot(user, [self, spouse, child], items, [], NOW);
    expect(s.lifeCover).toBe(10500000);
    // self: max(floater 10L, employer 5L) = 10L; spouse: 10L; child: 3L -> household = 3L
    expect(s.healthCover).toBe(300000);
    expect(s.nominationsSet).toBe(true);
    expect(s.provided).toEqual(expect.arrayContaining(["lifeCover", "healthCover", "nominationsSet"]));
  });

  it("marks nominations unset when any flagged item lacks one", () => {
    const items = [
      item("investments", "stocks", { label: "", currentValue: 10000, sipMonthly: 0, assetClass: "equity", risk: "high", retirementTagged: false, nomineeSet: true }),
      item("assets", "cash", { label: "", currentValue: 10000, liquidity: "liquid", nomineeSet: false }),
    ];
    expect(buildSnapshot(user, [self], items, [], NOW).nominationsSet).toBe(false);
  });

  it("maps goals to years from the target date", () => {
    const s = buildSnapshot(user, [self], [], [goal(1000000, "2031-10-18", 5000, 100000)], NOW);
    expect(s.goals).toHaveLength(1);
    expect(s.goals![0].years).toBeCloseTo(5, 1);
    expect(s.goals![0]).toMatchObject({ targetToday: 1000000, assigned: 100000, monthlySip: 5000 });
    expect(s.provided).toContain("goals");
  });

  it("lists the most valuable missing fields first", () => {
    expect(missingFields(["monthlyIncome", "age"], 3)).toEqual(["monthlyExpenses", "liquidAssets", "lifeCover"]);
    expect(missingFields(undefined, 2)).toEqual(["monthlyIncome", "monthlyExpenses"]);
  });
});

describe("quick-start cover answers", () => {
  const income = [item("income", "salary", { netMonthly: 100000, frequency: "monthly" } as Payload<"income">)];
  it("counts a no as known zero cover", () => {
    const s = buildSnapshot({ ...user, hasTermCover: false, hasHealthCover: false }, [self], income, [], NOW);
    expect(s.provided).toContain("lifeCover");
    expect(s.provided).toContain("healthCover");
    expect(s.lifeCover).toBe(0);
  });
  it("leaves yes or not sure unknown until a policy is added", () => {
    for (const answer of [true, null, undefined]) {
      const s = buildSnapshot({ ...user, hasTermCover: answer, hasHealthCover: answer }, [self], income, [], NOW);
      expect(s.provided).not.toContain("lifeCover");
      expect(s.provided).not.toContain("healthCover");
    }
  });
});
