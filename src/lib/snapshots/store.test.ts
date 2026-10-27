import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, query } from "../db";
import { createUser, householdForUser, updateUser } from "../auth/users";
import { createItem } from "../data/store";
import { currentAndPrevious, listSnapshots, recordMonthlySnapshot, recordSnapshotsForAllHouseholds } from "./store";

const url = process.env.DATABASE_URL;
const TABLES = ["monthly_snapshots", "audit_events", "plan_items", "checkups", "goals", "financial_items", "household_members", "households", "consents", "webauthn_challenges", "passkeys", "email_tokens", "sessions", "users"];

describe.skipIf(!url)("monthly snapshots", () => {
  let userId = "";
  let householdId = "";
  let emptyHousehold = "";

  beforeAll(async () => {
    const p = await getPool();
    for (const t of TABLES) await p.query(`DELETE FROM ${t}`);
    const u = await createUser({ email: "kavi@example.in", passwordHash: "x", name: "Kavi", locale: "en" });
    userId = u.id;
    await updateUser(userId, { dob: "1992-03-01", employment: "salaried", city_tier: 2 });
    householdId = (await householdForUser(userId))!.id;
    const e = await createUser({ email: "empty@example.in", passwordHash: "x", name: "Empty", locale: "en" });
    emptyHousehold = (await householdForUser(e.id))!.id;
    await createItem(householdId, userId, { family: "income", type: "salary", payload: { netMonthly: 80000 } });
    await createItem(householdId, userId, { family: "expenses", type: "housing", payload: { monthly: 30000 } });
    await createItem(householdId, userId, { family: "assets", type: "cash", payload: { currentValue: 200000 } });
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("writes one encrypted row per month and rewrites it on later changes", async () => {
    const sep = new Date("2026-09-15T00:00:00Z");
    const first = await recordMonthlySnapshot(householdId, userId, sep);
    expect(first?.month).toBe("2026-09");
    expect(first?.netWorth).toBe(200000);
    await createItem(householdId, userId, { family: "loans", type: "personal", payload: { outstanding: 50000, emi: 2500, interestPct: 14 } });
    const again = await recordMonthlySnapshot(householdId, userId, sep);
    expect(again?.netWorth).toBe(150000);
    const rows = await query("SELECT month, payload_enc FROM monthly_snapshots WHERE household_id = ?", [householdId]);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].payload_enc)).not.toContain("200000");
    expect(await recordMonthlySnapshot(emptyHousehold, userId, sep)).toBeUndefined();
  });

  it("lists newest first and pairs this month with the previous one", async () => {
    const oct = new Date("2026-10-27T00:00:00Z");
    await recordMonthlySnapshot(householdId, userId, oct);
    const list = await listSnapshots(householdId);
    expect(list.map((s) => s.month)).toEqual(["2026-10", "2026-09"]);
    const { current, previous } = await currentAndPrevious(householdId, oct);
    expect(current?.month).toBe("2026-10");
    expect(previous?.month).toBe("2026-09");
    expect((await listSnapshots(emptyHousehold))).toEqual([]);
  });

  it("the monthly run fills in households with data that have no row this month", async () => {
    const nov = new Date("2026-11-01T01:00:00Z");
    expect(await recordSnapshotsForAllHouseholds(nov)).toEqual({ written: 1, skipped: 0 });
    expect(await recordSnapshotsForAllHouseholds(nov)).toEqual({ written: 0, skipped: 0 });
    expect((await listSnapshots(householdId)).map((s) => s.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    await execute("UPDATE users SET deletion_requested_at = NOW() WHERE id = ?", [userId]);
    expect(await recordSnapshotsForAllHouseholds(new Date("2026-12-01T01:00:00Z"))).toEqual({ written: 0, skipped: 0 });
    await execute("UPDATE users SET deletion_requested_at = NULL WHERE id = ?", [userId]);
  });
});
