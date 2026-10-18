import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, getPool } from "../db";
import { createUser, findUserById, householdForUser } from "../auth/users";
import { parseItem } from "./forms";
import { syncDependants } from "./members";
import { archiveItem, archiveMember, createItem, createMember, getItem, listItems, listMembers, updateMember } from "./store";

const url = process.env.DATABASE_URL;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe.skipIf(!url)("financial items and members", () => {
  let userId = "";
  let householdId = "";

  beforeAll(async () => {
    const p = await getPool();
    for (const t of ["audit_events", "financial_items", "household_members", "households", "consents", "email_tokens", "sessions", "users"]) await p.query(`DELETE FROM ${t}`);
    const u = await createUser({ email: "data@example.in", passwordHash: "x", name: "Ravi", locale: "en" });
    userId = u.id;
    householdId = (await householdForUser(u.id))!.id;
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("stores a parsed item encrypted and reads it back, hiding it once archived", async () => {
    const members = (await listMembers(householdId)).map((m) => m.id);
    const parsed = parseItem("loans", fd({ type: "home", confidence: "entered", memberId: members[0], label: "HDFC", outstanding: "2500000", emi: "24000", interestPct: "8.5", monthsLeft: "180", insured: "on" }), members);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const item = await createItem(householdId, userId, { family: "loans", ...parsed.data });
    expect(item.payload).toMatchObject({ label: "HDFC", outstanding: 2500000, emi: 24000, interestPct: 8.5, monthsLeft: 180, insured: true, prepaymentPenalty: false });
    const p = await getPool();
    const [rows] = await p.query<{ payload_enc: string }[] & import("mysql2").RowDataPacket[]>("SELECT payload_enc FROM financial_items WHERE id = ?", [item.id]);
    expect(rows[0].payload_enc).not.toContain("HDFC");
    expect((await listItems(householdId, "loans")).map((i) => i.id)).toEqual([item.id]);
    expect(await getItem("other-household", item.id)).toBeUndefined();
    await archiveItem(householdId, userId, item.id);
    expect(await listItems(householdId, "loans")).toEqual([]);
    expect(await getItem(householdId, item.id)).toBeUndefined();
  });

  it("keeps users.dependants equal to the number of dependant members", async () => {
    expect((await findUserById(userId))!.dependants).toBe(0);
    const child = await createMember(householdId, userId, { name: "Anu", relation: "child", dob: "2018-02-03", earns: false, dependant: true });
    const spouse = await createMember(householdId, userId, { name: "Meena", relation: "spouse", earns: true, dependant: false });
    expect(await syncDependants(householdId, userId)).toBe(1);
    expect((await findUserById(userId))!.dependants).toBe(1);

    await updateMember(householdId, userId, spouse.id, { name: "Meena", relation: "spouse", earns: false, dependant: true });
    expect(await syncDependants(householdId, userId)).toBe(2);

    await archiveMember(householdId, userId, child.id);
    expect(await syncDependants(householdId, userId)).toBe(1);
    expect((await listMembers(householdId)).map((m) => m.name)).toEqual(["Ravi", "Meena"]);

    // The self row can never be archived.
    const self = (await listMembers(householdId)).find((m) => m.relation === "self")!;
    await archiveMember(householdId, userId, self.id);
    expect((await listMembers(householdId)).some((m) => m.relation === "self")).toBe(true);
  });
});
