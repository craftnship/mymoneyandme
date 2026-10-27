import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, query } from "../db";
import { createUser, householdForUser } from "../auth/users";
import { archiveItem, archiveMember, createItem, createMember, getItem, listItems, listMembers, updateItem, updateMember } from "../data/store";
import { archiveGoal, createGoal, getGoal, listGoals, updateGoal } from "../goals/store";
import { getCheckUp, latestCheckUp, listCheckUps, previousCheckUp, runAndStoreCheckUp } from "../checkup/store";
import { planForHousehold, setPlanItemStatus } from "../checkup/planStore";
import { exportItems } from "./export";

const url = process.env.DATABASE_URL;
const TABLES = ["events", "audit_events", "plan_items", "checkups", "goals", "financial_items", "household_members", "households", "consents", "webauthn_challenges", "passkeys", "email_tokens", "sessions", "users"];

/**
 * Cross-user access (companion spec sections 5 and 32): every store call is
 * scoped by household, so a member who guesses another member's record id
 * gets nothing back and changes nothing. Asha and Bala each own a household;
 * every read and write below is tried with the wrong household.
 */
describe.skipIf(!url)("cross-user access is blocked", () => {
  let asha: { userId: string; householdId: string };
  let bala: { userId: string; householdId: string };
  const goalInput = { template: "custom", name: "Trip", targetDate: "2030-01-01", priority: "should" as const, flexibilityYears: 0, payload: { targetToday: 200000, inflationPct: 6, assignedAmount: 0, monthlySip: 2000 } };

  beforeAll(async () => {
    const p = await getPool();
    for (const t of TABLES) await p.query(`DELETE FROM ${t}`);
    const a = await createUser({ email: "asha@example.in", passwordHash: "x", name: "Asha", locale: "en" });
    const b = await createUser({ email: "bala@example.in", passwordHash: "x", name: "Bala", locale: "ta" });
    asha = { userId: a.id, householdId: (await householdForUser(a.id))!.id };
    bala = { userId: b.id, householdId: (await householdForUser(b.id))!.id };
    await execute("UPDATE users SET dob = '1990-01-01', employment = 'salaried' WHERE id IN (?, ?)", [a.id, b.id]);
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("financial items: read, update and archive are scoped to the household", async () => {
    const item = await createItem(asha.householdId, asha.userId, { family: "income", type: "salary", payload: { netMonthly: 90000 } });
    expect(await getItem(bala.householdId, item.id)).toBeUndefined();
    expect(await listItems(bala.householdId)).toEqual([]);
    expect(await updateItem(bala.householdId, bala.userId, item.id, { payload: { netMonthly: 1 } })).toBeUndefined();
    await archiveItem(bala.householdId, bala.userId, item.id);
    const still = await getItem<"income">(asha.householdId, item.id);
    expect(still?.payload.netMonthly).toBe(90000);
    expect(await exportItems(bala.householdId)).toEqual([]);
  });

  it("members: another household cannot rename or archive them", async () => {
    const child = await createMember(asha.householdId, asha.userId, { name: "Kavi", relation: "child", earns: false, dependant: true });
    await updateMember(bala.householdId, bala.userId, child.id, { name: "Hacked", relation: "child", earns: false, dependant: true });
    await archiveMember(bala.householdId, bala.userId, child.id);
    const members = await listMembers(asha.householdId);
    expect(members.find((m) => m.id === child.id)?.name).toBe("Kavi");
    expect(await listMembers(bala.householdId)).toHaveLength(1);
  });

  it("goals: read, update and archive are scoped to the household", async () => {
    const goal = await createGoal(asha.householdId, asha.userId, goalInput);
    expect(await getGoal(bala.householdId, goal.id)).toBeUndefined();
    expect(await listGoals(bala.householdId)).toEqual([]);
    expect(await updateGoal(bala.householdId, bala.userId, goal.id, { ...goalInput, name: "Hacked" })).toBeUndefined();
    await archiveGoal(bala.householdId, bala.userId, goal.id);
    expect((await getGoal(asha.householdId, goal.id))?.name).toBe("Trip");
  });

  it("check-ups and plans: another household sees neither the run nor the statuses", async () => {
    const first = await runAndStoreCheckUp(asha.householdId, asha.userId);
    const second = await runAndStoreCheckUp(asha.householdId, asha.userId);
    expect(await getCheckUp(bala.householdId, second.id)).toBeUndefined();
    expect(await latestCheckUp(bala.householdId)).toBeUndefined();
    expect(await listCheckUps(bala.householdId)).toEqual([]);
    expect(await previousCheckUp(bala.householdId, second.id)).toBeUndefined();
    expect((await previousCheckUp(asha.householdId, second.id))?.id).toBe(first.id);

    const plan = (await planForHousehold(asha.householdId))!;
    const itemId = plan.items[0].id;
    await setPlanItemStatus(asha.householdId, itemId, "done");
    expect(await planForHousehold(bala.householdId)).toBeUndefined();
    await setPlanItemStatus(bala.householdId, itemId, "skipped", "not mine");
    const again = (await planForHousehold(asha.householdId))!;
    expect(again.items.find((i) => i.id === itemId)?.status).toBe("done");
    const rows = await query("SELECT household_id, status FROM plan_items WHERE item_id = ?", [itemId]);
    expect(rows).toHaveLength(2);
  });

  it("every financial table row belongs to exactly one household", async () => {
    for (const table of ["financial_items", "goals", "checkups", "plan_items", "household_members"]) {
      const orphans = await query(`SELECT COUNT(*) AS n FROM ${table} t LEFT JOIN households h ON h.id = t.household_id WHERE h.id IS NULL`);
      expect(Number(orphans[0].n), table).toBe(0);
    }
  });
});
