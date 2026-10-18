import "server-only";
import { execute, newId, one, query, type Row } from "../db";
import { decryptJson, encryptJson } from "../db/crypto";
import { audit, findUserById } from "../auth/users";
import { listItems, listMembers } from "../data/store";
import { buildSnapshot } from "../data/snapshot";
import { listGoals } from "../goals/store";
import { runCheckUp, type CheckUpResult, type HouseholdSnapshot } from "./engine";

export { diffCheckUps } from "./progress";

/**
 * Stored check-ups (section 9): every run keeps the snapshot it scored and the
 * full result, both encrypted, plus clear score columns for history lists.
 */
export type StoredCheckUp = { id: string; householdId: string; createdAt: Date; snapshot: HouseholdSnapshot; result: CheckUpResult };
export type CheckUpSummary = { id: string; createdAt: Date; overall: number; grade: string; confidence: CheckUpResult["confidence"]; rulePackVersion: string };

type CheckUpRow = Row & { id: string; household_id: string; rulepack_version: string; inputs_enc: string; result_enc: string; overall: number; grade: string; confidence: CheckUpResult["confidence"]; created_at: Date };

function toStored(r: CheckUpRow): StoredCheckUp {
  return { id: r.id, householdId: r.household_id, createdAt: r.created_at, snapshot: decryptJson<HouseholdSnapshot>(r.inputs_enc), result: decryptJson<CheckUpResult>(r.result_enc) };
}

export async function runAndStoreCheckUp(householdId: string, userId: string): Promise<{ id: string; result: CheckUpResult; snapshot: HouseholdSnapshot }> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const [members, items, goals] = await Promise.all([listMembers(householdId), listItems(householdId), listGoals(householdId)]);
  const snapshot = buildSnapshot(user, members, items, goals);
  const result = runCheckUp(snapshot);
  const id = newId();
  await execute(
    "INSERT INTO checkups (id, household_id, rulepack_version, inputs_enc, result_enc, overall, grade, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, householdId, result.rulePackVersion, encryptJson(snapshot), encryptJson(result), result.overall, result.grade, result.confidence],
  );
  await audit(userId, "checkUpRun", "checkup", id);
  return { id, result, snapshot };
}

export async function latestCheckUp(householdId: string): Promise<StoredCheckUp | undefined> {
  const r = await one<CheckUpRow>("SELECT * FROM checkups WHERE household_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", [householdId]);
  return r && toStored(r);
}

export async function listCheckUps(householdId: string, limit = 24): Promise<CheckUpSummary[]> {
  const rows = await query<CheckUpRow>("SELECT id, household_id, rulepack_version, overall, grade, confidence, created_at FROM checkups WHERE household_id = ? ORDER BY created_at DESC, id DESC LIMIT ?", [householdId, limit]);
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, overall: r.overall, grade: r.grade, confidence: r.confidence, rulePackVersion: r.rulepack_version }));
}

export async function getCheckUp(householdId: string, id: string): Promise<StoredCheckUp | undefined> {
  const r = await one<CheckUpRow>("SELECT * FROM checkups WHERE id = ? AND household_id = ?", [id, householdId]);
  return r && toStored(r);
}

/** The run just before `id` for the same household, used for the "what changed" block. */
export async function previousCheckUp(householdId: string, id: string): Promise<StoredCheckUp | undefined> {
  const current = await one<Row & { created_at: Date }>("SELECT created_at FROM checkups WHERE id = ? AND household_id = ?", [id, householdId]);
  if (!current) return undefined;
  const r = await one<CheckUpRow>("SELECT * FROM checkups WHERE household_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 1", [householdId, current.created_at, current.created_at, id]);
  return r && toStored(r);
}
