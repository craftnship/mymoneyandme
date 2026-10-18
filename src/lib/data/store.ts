import "server-only";
import { execute, newId, one, query, type Row } from "../db";
import { decryptJson, encryptJson } from "../db/crypto";
import { audit } from "../auth/users";
import { PAYLOAD_SCHEMAS, type Confidence, type Family, type FinancialItem, type Payload } from "./model";

/**
 * Financial items store. Payloads are encrypted at rest (AES-256-GCM); only
 * family, type and member live in clear columns so lists can be filtered.
 * Items are archived, never deleted, until the account is purged.
 */
type ItemRow = Row & { id: string; household_id: string; family: Family; type: string; member_id: string | null; payload_enc: string; confidence: Confidence; created_at: Date; updated_at: Date };

function toItem<F extends Family>(r: ItemRow): FinancialItem<F> {
  return { id: r.id, householdId: r.household_id, family: r.family as F, type: r.type, memberId: r.member_id, payload: decryptJson<Payload<F>>(r.payload_enc), confidence: r.confidence, createdAt: r.created_at, updatedAt: r.updated_at };
}

export async function listItems<F extends Family>(householdId: string, family?: F): Promise<FinancialItem<F>[]> {
  const rows = family
    ? await query<ItemRow>("SELECT * FROM financial_items WHERE household_id = ? AND family = ? AND archived_at IS NULL ORDER BY created_at", [householdId, family])
    : await query<ItemRow>("SELECT * FROM financial_items WHERE household_id = ? AND archived_at IS NULL ORDER BY family, created_at", [householdId]);
  return rows.map((r) => toItem<F>(r));
}

export async function getItem<F extends Family>(householdId: string, id: string): Promise<FinancialItem<F> | undefined> {
  const r = await one<ItemRow>("SELECT * FROM financial_items WHERE id = ? AND household_id = ? AND archived_at IS NULL", [id, householdId]);
  return r && toItem<F>(r);
}

export async function createItem<F extends Family>(householdId: string, actorUserId: string, input: { family: F; type: string; memberId?: string | null; payload: unknown; confidence?: Confidence }): Promise<FinancialItem<F>> {
  const payload = PAYLOAD_SCHEMAS[input.family].parse(input.payload);
  const id = newId();
  await execute(
    "INSERT INTO financial_items (id, household_id, family, type, member_id, payload_enc, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, householdId, input.family, input.type, input.memberId ?? null, encryptJson(payload), input.confidence ?? "entered"],
  );
  await audit(actorUserId, "itemCreated", `item:${input.family}`, id);
  return (await getItem<F>(householdId, id))!;
}

export async function updateItem<F extends Family>(householdId: string, actorUserId: string, id: string, input: { type?: string; memberId?: string | null; payload: unknown; confidence?: Confidence }): Promise<FinancialItem<F> | undefined> {
  const existing = await getItem<F>(householdId, id);
  if (!existing) return undefined;
  const payload = PAYLOAD_SCHEMAS[existing.family].parse(input.payload);
  await execute(
    "UPDATE financial_items SET type = ?, member_id = ?, payload_enc = ?, confidence = ? WHERE id = ? AND household_id = ?",
    [input.type ?? existing.type, input.memberId === undefined ? existing.memberId : input.memberId, encryptJson(payload), input.confidence ?? existing.confidence, id, householdId],
  );
  await audit(actorUserId, "itemUpdated", `item:${existing.family}`, id);
  return getItem<F>(householdId, id);
}

export async function archiveItem(householdId: string, actorUserId: string, id: string): Promise<void> {
  await execute("UPDATE financial_items SET archived_at = NOW() WHERE id = ? AND household_id = ? AND archived_at IS NULL", [id, householdId]);
  await audit(actorUserId, "itemArchived", "item", id);
}

/** Household members (section 7). The owner's own row has relation 'self'. */
export type Member = { id: string; householdId: string; userId: string | null; name: string; relation: "self" | "spouse" | "child" | "parent" | "other"; dob: string | null; earns: boolean; dependant: boolean };
type MemberRow = Row & { id: string; household_id: string; user_id: string | null; name: string; relation: Member["relation"]; dob: Date | string | null; earns: number; dependant: number };

function toMember(r: MemberRow): Member {
  const dob = r.dob instanceof Date ? r.dob.toISOString().slice(0, 10) : r.dob ? String(r.dob).slice(0, 10) : null;
  return { id: r.id, householdId: r.household_id, userId: r.user_id, name: r.name, relation: r.relation, dob, earns: Boolean(r.earns), dependant: Boolean(r.dependant) };
}

export async function listMembers(householdId: string): Promise<Member[]> {
  const rows = await query<MemberRow>("SELECT * FROM household_members WHERE household_id = ? AND archived_at IS NULL ORDER BY relation = 'self' DESC, created_at", [householdId]);
  return rows.map(toMember);
}

export async function createMember(householdId: string, actorUserId: string, m: { name: string; relation: Member["relation"]; dob?: string | null; earns: boolean; dependant: boolean }): Promise<Member> {
  const id = newId();
  await execute("INSERT INTO household_members (id, household_id, name, relation, dob, earns, dependant) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, householdId, m.name.trim().slice(0, 100), m.relation, m.dob || null, m.earns ? 1 : 0, m.dependant ? 1 : 0]);
  await audit(actorUserId, "memberCreated", "member", id);
  return (await one<MemberRow>("SELECT * FROM household_members WHERE id = ?", [id]).then((r) => r && toMember(r)))!;
}

export async function updateMember(householdId: string, actorUserId: string, id: string, m: { name: string; relation: Member["relation"]; dob?: string | null; earns: boolean; dependant: boolean }): Promise<void> {
  await execute("UPDATE household_members SET name = ?, relation = ?, dob = ?, earns = ?, dependant = ? WHERE id = ? AND household_id = ?", [m.name.trim().slice(0, 100), m.relation, m.dob || null, m.earns ? 1 : 0, m.dependant ? 1 : 0, id, householdId]);
  await audit(actorUserId, "memberUpdated", "member", id);
}

export async function archiveMember(householdId: string, actorUserId: string, id: string): Promise<void> {
  await execute("UPDATE household_members SET archived_at = NOW() WHERE id = ? AND household_id = ? AND relation <> 'self'", [id, householdId]);
  await audit(actorUserId, "memberArchived", "member", id);
}
