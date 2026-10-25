import { describe, expect, it } from "vitest";
import { findConflicts, futureValue, monthsBetween, monthsToReach, projectGoal, requiredMonthlySip } from "./math";
import { dateYearsFromNow, defaultInflationPct, expectedReturn, GOAL_TEMPLATES, mixForHorizon } from "./templates";
import { diffCheckUps, isoDateFromNow, openItems, planProgress, projectedScore, type PlanItemWithStatus } from "../checkup/progress";
import { runCheckUp, type HouseholdSnapshot } from "../checkup/engine";
import { buildPlan } from "../checkup/plan";
import { fvLumpsum, fvSip } from "../calculators/math";
import type { Goal } from "./model";

const NOW = new Date("2026-10-18T00:00:00Z");

describe("goal templates", () => {
  it("covers every template from the requirements with a horizon hint", () => {
    expect(GOAL_TEMPLATES.map((t) => t.key)).toEqual(expect.arrayContaining(["emergencyFund", "childEducationUndergrad", "childWedding", "homePurchase", "homeRenovation", "vehicle", "vacation", "business", "debtFree", "retirement", "parentsCare", "wealth", "custom"]));
    for (const t of GOAL_TEMPLATES) expect(t.horizonYearsHint).toBeGreaterThan(0);
  });
  it("uses education inflation for education goals and none for wealth targets", () => {
    expect(defaultInflationPct("childEducationUndergrad")).toBe(10);
    expect(defaultInflationPct("custom")).toBe(6);
    expect(defaultInflationPct("wealth")).toBe(0);
  });
  it("picks a mix by horizon whose expected return rises with the horizon", () => {
    const s = mixForHorizon(2), m = mixForHorizon(5), l = mixForHorizon(12);
    expect(s.horizon).toBe("short");
    expect(m.horizon).toBe("medium");
    expect(l.horizon).toBe("long");
    for (const mix of [s, m, l]) expect(mix.equity + mix.debt + mix.liquid).toBeCloseTo(1);
    expect(expectedReturn(s)).toBeLessThan(expectedReturn(m));
    expect(expectedReturn(m)).toBeLessThan(expectedReturn(l));
  });
  it("pre-fills a date years from now", () => {
    expect(dateYearsFromNow(5, NOW)).toBe("2031-10-18");
    expect(isoDateFromNow(1, NOW)).toBe("2026-10-19");
  });
});

describe("goal maths", () => {
  it("inflates today's cost to the target date", () => {
    expect(futureValue(100000, 10, 2)).toBeCloseTo(121000, 0);
    expect(futureValue(100000, 0, 7)).toBe(100000);
    expect(monthsBetween(NOW, "2027-10-18")).toBe(12);
  });
  it("computes the SIP that exactly closes the gap", () => {
    const rate = 0.1;
    const sip = requiredMonthlySip(1000000, 100000, 5, rate);
    expect(fvLumpsum(100000, rate, 5) + fvSip(sip, rate, 60)).toBeCloseTo(1000000, 0);
    expect(requiredMonthlySip(100000, 500000, 5, rate)).toBe(0);
  });
  it("finds the month a path reaches the target, or null when it never does", () => {
    const m = monthsToReach(500000, 0, 10000, 0.1);
    expect(m).not.toBeNull();
    expect(fvSip(10000, 0.1, m!)).toBeGreaterThanOrEqual(500000);
    expect(fvSip(10000, 0.1, m! - 1)).toBeLessThan(500000);
    expect(monthsToReach(500000, 0, 0, 0.1)).toBeNull();
    expect(monthsToReach(0, 0, 0, 0.1)).toBe(0);
  });
  it("projects an on-track goal as ahead and an underfunded one as behind", () => {
    const ahead = projectGoal({ targetToday: 500000, inflationPct: 6, assignedAmount: 400000, monthlySip: 10000, targetDate: "2031-10-18" }, NOW);
    expect(ahead.onTrack).toBe(true);
    expect(ahead.progressPct).toBe(100);
    expect(ahead.monthsAhead).toBeGreaterThan(0);
    expect(ahead.requiredMonthlySip).toBeLessThan(10000);
    const behind = projectGoal({ targetToday: 2000000, inflationPct: 10, assignedAmount: 0, monthlySip: 2000, targetDate: "2031-10-18" }, NOW);
    expect(behind.onTrack).toBe(false);
    expect(behind.shortfall).toBeGreaterThan(0);
    expect(behind.monthsAhead).toBeLessThan(0);
    expect(behind.requiredMonthlySip).toBeGreaterThan(2000);
    expect(behind.mix.horizon).toBe("medium");
  });
  it("flags conflicts and names nice-to-have goals to trim", () => {
    const mk = (id: string, priority: Goal["priority"], sip: number): Goal & { projection: ReturnType<typeof projectGoal> } => ({
      id, householdId: "h", memberId: null, template: "custom", name: id, targetDate: "2031-10-18", priority, flexibilityYears: 0,
      payload: { targetToday: 1000000, inflationPct: 6, assignedAmount: 0, monthlySip: 0 }, createdAt: NOW, updatedAt: NOW,
      projection: { ...projectGoal({ targetToday: 1000000, inflationPct: 6, assignedAmount: 0, monthlySip: 0, targetDate: "2031-10-18" }, NOW), requiredMonthlySip: sip },
    });
    const goals = [mk("must", "must", 15000), mk("nice-small", "nice", 3000), mk("nice-big", "nice", 8000)];
    expect(findConflicts(goals, 30000)).toBeNull();
    const c = findConflicts(goals, 20000)!;
    expect(c.shortfall).toBe(6000);
    expect(c.trimCandidates.map((t) => t.id)).toEqual(["nice-big", "nice-small"]);
  });
});

describe("check-up progress helpers", () => {
  const base: HouseholdSnapshot = {
    age: 35, employment: "salaried", dependants: 2, cityTier: 1, monthlyIncome: 100000, monthlyExpenses: 90000, liquidAssets: 50000,
    investments: { equity: 0, debt: 0, gold: 0, realEstate: 0 }, retirementCorpus: 0, monthlyEmi: 30000, highCostDebt: 100000, totalDebt: 500000, lifeCover: 0, healthCover: 0,
  };
  const weak = runCheckUp(base);
  const strong = runCheckUp({ ...base, monthlyExpenses: 50000, liquidAssets: 600000, lifeCover: 15000000, healthCover: 1000000, highCostDebt: 0, nominationsSet: true, willInPlace: true });

  it("diffs two runs by overall, grade and dimension", () => {
    const d = diffCheckUps(weak, strong);
    expect(d.overall.delta).toBe(strong.overall - weak.overall);
    expect(d.overall.delta).toBeGreaterThan(0);
    expect(d.dimensions).toHaveLength(8);
    expect(d.improved).toContain("insurance");
    expect(d.worsened).not.toContain("insurance");
    expect(Math.abs(d.dimensions[0].delta)).toBeGreaterThanOrEqual(Math.abs(d.dimensions[7].delta));
  });

  it("does not count a dimension that was unscored in either run as movement", () => {
    const partial = runCheckUp({ ...base, provided: ["monthlyIncome", "monthlyExpenses", "liquidAssets", "monthlyEmi"] });
    const fuller = runCheckUp({ ...base, lifeCover: 15000000, healthCover: 1000000, provided: ["monthlyIncome", "monthlyExpenses", "liquidAssets", "monthlyEmi", "lifeCover", "healthCover"] });
    const d = diffCheckUps(partial, fuller);
    const ins = d.dimensions.find((x) => x.key === "insurance")!;
    expect(ins.statusFrom).toBe("unknown");
    expect(ins.delta).toBe(0);
    expect(d.improved).not.toContain("insurance");
  });

  it("tracks progress, skips snoozed items until their date and projects the next three", () => {
    const items: PlanItemWithStatus[] = buildPlan(weak, base.monthlyIncome).map((i) => ({ ...i, status: "todo", skipReason: null, snoozedUntil: null, updatedAt: null }));
    expect(items.length).toBeGreaterThan(3);
    items[0].status = "done";
    items[1].status = "skipped";
    items[2].status = "snoozed";
    items[2].snoozedUntil = "2099-01-01";
    items[3].status = "snoozed";
    items[3].snoozedUntil = "2020-01-01";
    const p = planProgress(items);
    expect(p.total).toBe(items.length - 1);
    expect(p.done).toBe(1);
    const open = openItems(items, "2026-10-18");
    expect(open.map((i) => i.id)).not.toContain(items[0].id);
    expect(open.map((i) => i.id)).not.toContain(items[2].id);
    expect(open.map((i) => i.id)).toContain(items[3].id);
    const proj = projectedScore(weak.overall, items, 3);
    expect(proj.items.length).toBeLessThanOrEqual(3);
    expect(proj.score).toBeGreaterThanOrEqual(weak.overall);
    expect(proj.score).toBeLessThanOrEqual(100);
  });
});
