import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, query } from "./index";
import { createUser, currentConsents, findUserByEmail, householdForUser, issueEmailToken, consumeEmailToken, recordConsents, recordLoginFailure, isLocked, clearLoginFailures } from "../auth/users";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("database schema and user repository", () => {
  beforeAll(async () => {
    const p = await getPool();
    for (const t of ["monthly_snapshots", "audit_events", "plan_items", "checkups", "goals", "financial_items", "household_members", "households", "consents", "webauthn_challenges", "passkeys", "email_tokens", "sessions", "users"]) await p.query(`DELETE FROM ${t}`);
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("applies migrations once", async () => {
    const rows = await query("SELECT id FROM schema_migrations");
    expect(rows.map((r) => r.id)).toContain("0001_member_app");
    _resetForTests();
    await getPool();
    expect((await query("SELECT id FROM schema_migrations")).length).toBe(rows.length);
  });

  it("creates a user with a household and a self member", async () => {
    const u = await createUser({ email: "Asha@Example.in", passwordHash: "x", name: "Asha", locale: "ta" });
    expect(u.email).toBe("asha@example.in");
    expect((await findUserByEmail("asha@example.in"))?.id).toBe(u.id);
    const h = await householdForUser(u.id);
    expect(h?.name).toBe("Asha");
    const members = await query("SELECT relation, earns FROM household_members WHERE household_id = ?", [h!.id]);
    expect(members).toEqual([expect.objectContaining({ relation: "self", earns: 1 })]);
  });

  it("records consent history and reports the latest decision", async () => {
    const u = (await findUserByEmail("asha@example.in"))!;
    await recordConsents(u.id, { analytics: true, marketing: false });
    await recordConsents(u.id, { analytics: false });
    expect(await currentConsents(u.id)).toEqual({ analytics: false, marketing: false, peerComparison: false, personalisation: false, planReminders: false });
    expect((await query("SELECT id FROM consents WHERE user_id = ?", [u.id])).length).toBe(3);
  });

  it("issues single-use email tokens and locks after repeated failures", async () => {
    const u = (await findUserByEmail("asha@example.in"))!;
    const token = await issueEmailToken(u.id, "verify");
    expect(await consumeEmailToken(token, "reset")).toBeNull();
    expect(await consumeEmailToken(token, "verify")).toBe(u.id);
    expect(await consumeEmailToken(token, "verify")).toBeNull();
    for (let i = 0; i < 9; i++) await recordLoginFailure(u.id);
    expect(await isLocked(u.id)).toBe(false);
    await recordLoginFailure(u.id);
    expect(await isLocked(u.id)).toBe(true);
    await clearLoginFailures(u.id);
    expect(await isLocked(u.id)).toBe(false);
    await execute("DELETE FROM email_tokens WHERE user_id = ?", [u.id]);
  });
});
