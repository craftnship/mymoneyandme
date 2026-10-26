import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, newId, query } from "../db";
import { isPublicEvent, recordEvent } from "./store";
import { lastMonths, monthKey, usageReport } from "./usage";

const url = process.env.DATABASE_URL;

describe("usage helpers", () => {
  it("lists the last months oldest first", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    expect(lastMonths(3, now).map(monthKey)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(lastMonths(2, new Date("2026-01-15T00:00:00Z")).map(monthKey)).toEqual(["2025-12", "2026-01"]);
  });
  it("only accepts the allow-listed event names", () => {
    expect(isPublicEvent("calculatorUsed")).toBe(true);
    expect(isPublicEvent("signIn")).toBe(false);
  });
});

describe.skipIf(!url)("usage report", () => {
  const u1 = newId();
  const u2 = newId();
  const u3 = newId();
  const now = new Date();
  const at = (daysAgo: number, hours = 0) => new Date(now.getTime() - daysAgo * 24 * 3600 * 1000 + hours * 3600 * 1000);

  beforeAll(async () => {
    const p = await getPool();
    await p.query("DELETE FROM events");
    await p.query("DELETE FROM audit_events");
    const rows: [string | null, string, Date][] = [
      [u1, "signUp", at(20)], [u1, "checkUpRun", at(20, 2)], [u1, "plan.done", at(5)], [u1, "goalCreated", at(4)],
      [u2, "signUp", at(10)], [u2, "signIn", at(1)],
      [u3, "signUp", at(50)], [u3, "checkUpRun", at(49)], [u3, "itemUpdated", at(45)],
    ];
    for (const [actor, action, when] of rows) await execute("INSERT INTO audit_events (actor_user_id, action, entity, at) VALUES (?, ?, 'user', ?)", [actor, action, when]);
    await execute("INSERT INTO events (name, detail, at) VALUES ('calculatorUsed', 'sip', ?), ('calculatorUsed', 'sip', ?), ('calculatorUsed', 'emi', ?), ('quickCheckRun', NULL, ?)", [at(3), at(2), at(40), at(1)]);
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("records only clean details and never fails the caller", async () => {
    expect(await recordEvent("calculatorUsed", "Bad Slug!")).toBe(true);
    const r = await query("SELECT detail FROM events WHERE name = 'calculatorUsed' ORDER BY id DESC LIMIT 1");
    expect(r[0].detail).toBeNull();
  });

  it("counts active planners, sign-ups, funnels and top calculators without reading any amounts", async () => {
    const r = await usageReport(now);
    expect(r.last30.signUps).toBe(2);
    expect(r.last30.activePlanners).toBe(1); // u1 acted; u2 only signed in; u3 is older than 30 days
    expect(r.last30.signedIn).toBe(1);
    expect(r.last30.stepsDone).toBe(1);
    expect(r.last30.goalsCreated).toBe(1);
    expect(r.last30.calculatorRuns).toBe(3); // two seeded plus the one recorded above
    expect(r.last30.quickChecks).toBe(1);
    expect(r.previous30.activePlanners).toBe(1); // u3
    expect(r.previous30.calculatorRuns).toBe(1);
    expect(r.months).toHaveLength(6);
    expect(r.months[5].month).toBe(monthKey(now));
    expect(r.months.reduce((s, m) => s + m.signUps, 0)).toBe(3);
    expect(r.activation).toEqual({ signedUp: 3, ranCheckUp: 2, createdGoal: 1, medianHoursToCheckUp: 24 });
    expect(r.topCalculators[0]).toEqual({ slug: "sip", runs: 2 });
  });
});
