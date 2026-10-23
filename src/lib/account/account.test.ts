import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, newId, query } from "../db";
import { encryptJson } from "../db/crypto";
import { createUser, currentConsents, findUserById, householdForUser, issueEmailToken, recordConsents, updateUser } from "../auth/users";
import { purgeDueDeletions, purgeUser } from "./purge";
import { buildExport, exportItems, itemsToCsv } from "./export";
import { clearDeletionRequest, consentDecidedAt, getHealthFlags } from "./store";

const url = process.env.DATABASE_URL;
const TABLES = ["audit_events", "plan_items", "checkups", "goals", "financial_items", "household_members", "households", "consents", "webauthn_challenges", "passkeys", "email_tokens", "sessions", "users"];

async function seedUser(email: string) {
  const user = await createUser({ email, passwordHash: "x", name: "Priya", locale: "en" });
  const household = (await householdForUser(user.id))!;
  await execute("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [newId(), user.id, newId()]);
  await execute("INSERT INTO passkeys (id, user_id, public_key) VALUES (?, ?, ?)", [newId(), user.id, Buffer.from("k")]);
  await issueEmailToken(user.id, "delete");
  await recordConsents(user.id, { analytics: true });
  await execute("INSERT INTO financial_items (id, household_id, family, type, payload_enc) VALUES (?, ?, 'income', 'salary', ?)", [newId(), household.id, encryptJson({ label: "Job, main", netMonthly: 85000, frequency: "monthly", taxable: true })]);
  await execute("INSERT INTO financial_items (id, household_id, family, type, payload_enc, archived_at) VALUES (?, ?, 'loans', 'home', ?, NOW())", [newId(), household.id, encryptJson({ label: "Flat", outstanding: 2500000, emi: 24000, rateType: "floating" })]);
  await execute("INSERT INTO goals (id, household_id, template, name, target_date, payload_enc) VALUES (?, ?, 'retirement', 'Retire', '2050-01-01', ?)", [newId(), household.id, encryptJson({ target: 50000000 })]);
  await execute("INSERT INTO checkups (id, household_id, rulepack_version, inputs_enc, result_enc, overall, grade, confidence) VALUES (?, ?, '1.0', ?, ?, 70, 'good', 'high')", [newId(), household.id, encryptJson({ a: 1 }), encryptJson({ overall: 70 })]);
  await execute("INSERT INTO plan_items (household_id, item_id, status) VALUES (?, 'emergency-fund', 'done')", [household.id]);
  await execute("INSERT INTO audit_events (actor_user_id, action, entity, entity_id) VALUES (?, 'signIn', 'user', ?)", [user.id, user.id]);
  return { user, household };
}

async function count(table: string, column: string, id: string) {
  return (await query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, [id]))[0].n as number;
}

describe.skipIf(!url)("account settings: purge, consents, export", () => {
  beforeEach(async () => {
    const p = await getPool();
    for (const t of TABLES) await p.query(`DELETE FROM ${t}`);
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("purges only accounts past the 30-day grace period and keeps anonymised audit events", async () => {
    const due = await seedUser("due@example.in");
    const recent = await seedUser("recent@example.in");
    const keep = await seedUser("keep@example.in");
    await execute("UPDATE users SET deletion_requested_at = DATE_SUB(NOW(), INTERVAL 31 DAY) WHERE id = ?", [due.user.id]);
    await execute("UPDATE users SET deletion_requested_at = DATE_SUB(NOW(), INTERVAL 10 DAY) WHERE id = ?", [recent.user.id]);

    expect(await purgeDueDeletions()).toBe(1);

    expect(await findUserById(due.user.id)).toBeUndefined();
    for (const [table, column, id] of [
      ["sessions", "user_id", due.user.id], ["passkeys", "user_id", due.user.id], ["email_tokens", "user_id", due.user.id], ["consents", "user_id", due.user.id],
      ["households", "owner_user_id", due.user.id], ["household_members", "household_id", due.household.id], ["financial_items", "household_id", due.household.id],
      ["goals", "household_id", due.household.id], ["checkups", "household_id", due.household.id], ["plan_items", "household_id", due.household.id],
    ] as const) expect(await count(table, column, id), table).toBe(0);
    expect(await count("audit_events", "actor_user_id", due.user.id)).toBe(0);
    const anonymised = await query("SELECT action FROM audit_events WHERE actor_user_id IS NULL ORDER BY id");
    expect(anonymised.map((r) => r.action)).toEqual(["signIn", "accountPurged"]);

    // The others are untouched, including the one still inside its grace period.
    for (const u of [recent, keep]) {
      expect(await findUserById(u.user.id)).toBeDefined();
      expect(await count("financial_items", "household_id", u.household.id)).toBe(2);
      expect(await count("sessions", "user_id", u.user.id)).toBe(1);
    }
    expect(await purgeDueDeletions()).toBe(0);
  });

  it("purgeUser removes one account directly and clearDeletionRequest cancels a pending one", async () => {
    const a = await seedUser("a@example.in");
    const b = await seedUser("b@example.in");
    await purgeUser(a.user.id);
    expect(await findUserById(a.user.id)).toBeUndefined();
    expect(await findUserById(b.user.id)).toBeDefined();
    await execute("UPDATE users SET deletion_requested_at = NOW() WHERE id = ?", [b.user.id]);
    expect((await findUserById(b.user.id))!.deletionRequestedAt).not.toBeNull();
    await clearDeletionRequest(b.user.id);
    expect((await findUserById(b.user.id))!.deletionRequestedAt).toBeNull();
  });

  it("keeps consent history append-only and reports the latest decision with its date", async () => {
    const { user } = await seedUser("c@example.in");
    await recordConsents(user.id, { analytics: false, peerComparison: true });
    await recordConsents(user.id, { peerComparison: false });
    expect(await currentConsents(user.id)).toEqual({ analytics: false, marketing: false, peerComparison: false, personalisation: false, planReminders: false });
    expect((await query("SELECT id FROM consents WHERE user_id = ?", [user.id])).length).toBe(4);
    const decided = await consentDecidedAt(user.id);
    expect(decided.analytics).toBeInstanceOf(Date);
    expect(decided.peerComparison).toBeInstanceOf(Date);
    expect(decided.marketing).toBeUndefined();
    expect(decided.personalisation).toBeUndefined();
  });

  it("stores the optional health flags and reads them back as tri-state", async () => {
    const { user } = await seedUser("h@example.in");
    expect(await getHealthFlags(user.id)).toEqual({ smoker: null, existingConditions: null });
    await updateUser(user.id, { smoker: 1, existing_conditions: 0, risk_profile: "growth" });
    expect(await getHealthFlags(user.id)).toEqual({ smoker: true, existingConditions: false });
    expect((await findUserById(user.id))!.riskProfile).toBe("growth");
  });

  it("exports decrypted data as JSON and flattened items as CSV, including archived rows", async () => {
    const { user, household } = await seedUser("e@example.in");
    const data = await buildExport((await findUserById(user.id))!, household);
    expect(data.profile.email).toBe("e@example.in");
    expect(data.members).toHaveLength(1);
    expect(data.financialItems).toHaveLength(2);
    expect(data.financialItems[0].payload).toMatchObject({ netMonthly: 85000 });
    expect(data.goals[0].payload).toEqual({ target: 50000000 });
    expect(data.checkUps[0].result).toEqual({ overall: 70 });
    expect(data.planItems[0]).toMatchObject({ itemId: "emergency-fund", status: "done" });
    expect(data.consents.current.analytics).toBe(true);
    expect(data.consents.history).toHaveLength(1);

    const csv = itemsToCsv(await exportItems(household.id));
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("id,family,type,memberId,confidence,createdAt,updatedAt,archivedAt,emi,frequency,label,netMonthly,outstanding,rateType,taxable");
    expect(lines[1]).toContain(',income,salary,,entered,');
    expect(lines[1]).toContain('"Job, main"');
    expect(lines[2]).toContain(",loans,home,");
    expect(lines[2]).toMatch(/,\d{4}-\d{2}-\d{2}T[^,]+,24000,,Flat,,2500000,floating,$/);
  });
});
