import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, getPool, query } from "../db";
import { createUser, householdForUser, updateUser } from "../auth/users";
import { createItem, createMember } from "../data/store";
import { archiveGoal, createGoal, getGoal, listGoals, updateGoal } from "../goals/store";
import { getCheckUp, latestCheckUp, listCheckUps, previousCheckUp, runAndStoreCheckUp } from "./store";
import { planForHousehold, setPlanItemStatus } from "./planStore";
import { diffCheckUps } from "./progress";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("check-up, plan and goal stores", () => {
  let userId = "";
  let householdId = "";

  beforeAll(async () => {
    const p = await getPool();
    for (const t of ["audit_events", "plan_items", "checkups", "goals", "financial_items", "household_members", "households", "consents", "webauthn_challenges", "passkeys", "email_tokens", "sessions", "users"]) await p.query(`DELETE FROM ${t}`);
    const u = await createUser({ email: "priya@example.in", passwordHash: "x", name: "Priya", locale: "en" });
    userId = u.id;
    await updateUser(userId, { dob: "1990-05-01", dependants: 1, city_tier: 1 });
    householdId = (await householdForUser(userId))!.id;
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("stores goals encrypted and scopes them by household", async () => {
    const g = await createGoal(householdId, userId, { template: "childEducationUndergrad", name: "Meera's degree", targetDate: "2036-06-01", priority: "must", flexibilityYears: 1, payload: { targetToday: "2000000", inflationPct: "10", assignedAmount: "100000", monthlySip: "5000" } });
    expect(g.payload).toEqual({ targetToday: 2000000, inflationPct: 10, assignedAmount: 100000, monthlySip: 5000 });
    const raw = await query("SELECT payload_enc FROM goals WHERE id = ?", [g.id]);
    expect(String(raw[0].payload_enc)).not.toContain("2000000");
    expect(await getGoal("other-household", g.id)).toBeUndefined();
    const updated = await updateGoal(householdId, userId, g.id, { template: g.template, name: "Meera's degree", targetDate: "2037-06-01", priority: "should", flexibilityYears: 2, payload: { ...g.payload, monthlySip: 8000 } });
    expect(updated?.targetDate).toBe("2037-06-01");
    expect(updated?.payload.monthlySip).toBe(8000);
    expect((await listGoals(householdId)).map((x) => x.id)).toEqual([g.id]);
  });

  it("runs, stores and lists check-ups with an encrypted snapshot and result", async () => {
    const first = await runAndStoreCheckUp(householdId, userId);
    expect(first.result.overall).toBeGreaterThanOrEqual(0);
    expect(first.snapshot.goals).toHaveLength(1);
    expect(first.result.confidence).toBe("low");

    await createMember(householdId, userId, { name: "Arun", relation: "spouse", earns: true, dependant: false });
    await createItem(householdId, userId, { family: "income", type: "salary", payload: { netMonthly: 150000 } });
    await createItem(householdId, userId, { family: "expenses", type: "housing", payload: { monthly: 40000, essential: true } });
    await createItem(householdId, userId, { family: "expenses", type: "lifestyle", payload: { monthly: 20000, essential: false } });
    await createItem(householdId, userId, { family: "assets", type: "fixedDeposit", payload: { currentValue: 600000, liquidity: "nearLiquid", nomineeSet: true } });
    await createItem(householdId, userId, { family: "insurance", type: "termLife", payload: { sumAssured: 20000000, nomineeSet: true } });
    await createItem(householdId, userId, { family: "insurance", type: "healthFloater", payload: { sumAssured: 1000000 } });

    const second = await runAndStoreCheckUp(householdId, userId);
    expect(second.snapshot.monthlyIncome).toBe(150000);
    expect(second.snapshot.dualIncome).toBe(true);
    expect(second.snapshot.lifeCover).toBe(20000000);
    // With no data the engine scores defaults (and reports low confidence), so compare the dimension the new data feeds.
    const insurance = (r: typeof second) => r.result.dimensions.find((d) => d.key === "insurance")!.score;
    expect(insurance(second)).toBeGreaterThan(insurance(first));
    expect(second.result.confidence).not.toBe("low");

    const latest = await latestCheckUp(householdId);
    expect(latest?.id).toBe(second.id);
    const history = await listCheckUps(householdId);
    expect(history.map((h) => h.id)).toEqual([second.id, first.id]);
    expect(await getCheckUp("other-household", second.id)).toBeUndefined();
    const prev = await previousCheckUp(householdId, second.id);
    expect(prev?.id).toBe(first.id);
    expect(await previousCheckUp(householdId, first.id)).toBeUndefined();
    const diff = diffCheckUps(prev!.result, latest!.result);
    expect(diff.overall.delta).toBe(second.result.overall - first.result.overall);
    // Insurance had no data the first time, so it moves from unknown to scored rather than counting as improved.
    expect(diff.dimensions.find((d) => d.key === "insurance")).toMatchObject({ statusFrom: "unknown", delta: 0 });
    expect(diff.improved).not.toContain("insurance");

    const raw = await query("SELECT inputs_enc, result_enc, overall FROM checkups WHERE id = ?", [second.id]);
    expect(String(raw[0].inputs_enc)).not.toContain("150000");
    expect(raw[0].overall).toBe(second.result.overall);
  });

  it("builds the plan from the latest run and keeps item statuses across re-runs", async () => {
    const plan = (await planForHousehold(householdId))!;
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.every((i) => i.status === "todo")).toBe(true);
    expect(plan.items.length).toBeGreaterThanOrEqual(2);
    const target = plan.items[0];
    const skipped = plan.items[1];
    await setPlanItemStatus(householdId, target.id, "done");
    await setPlanItemStatus(householdId, "annual-review", "snoozed", null, "2030-01-01");
    await setPlanItemStatus(householdId, skipped.id, "skipped", "Already have one");

    await runAndStoreCheckUp(householdId, userId);
    const again = (await planForHousehold(householdId))!;
    expect(again.items.find((i) => i.id === target.id)?.status).toBe("done");
    expect(again.items.find((i) => i.id === "annual-review")).toMatchObject({ status: "snoozed", snoozedUntil: "2030-01-01" });
    expect(again.items.find((i) => i.id === skipped.id)).toMatchObject({ status: "skipped", skipReason: "Already have one" });
    // Moving back to "to do" clears the reason and the snooze date.
    await setPlanItemStatus(householdId, skipped.id, "todo");
    const back = (await planForHousehold(householdId))!;
    expect(back.items.find((i) => i.id === skipped.id)).toMatchObject({ status: "todo", skipReason: null, snoozedUntil: null });
  });

  it("archives goals so they leave lists and the next check-up", async () => {
    const [g] = await listGoals(householdId);
    await archiveGoal(householdId, userId, g.id);
    expect(await listGoals(householdId)).toEqual([]);
    const run = await runAndStoreCheckUp(householdId, userId);
    expect(run.snapshot.goals).toBeUndefined();
  });
});
