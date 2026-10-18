import "server-only";
import { execute, newId, one, query, type Row } from "../db";
import { decryptJson, encryptJson } from "../db/crypto";
import { audit } from "../auth/users";
import { GOAL_PAYLOAD_SCHEMA, GOAL_PRIORITIES, type Goal, type GoalPayload, type GoalPriority } from "./model";

/**
 * Goals store (section 10). Amounts are encrypted at rest; template, name,
 * date and priority stay in clear columns so lists can sort without
 * decrypting. Goals are archived, never deleted.
 */
type GoalRow = Row & { id: string; household_id: string; member_id: string | null; template: string; name: string; target_date: Date | string; priority: string; flexibility_years: number; payload_enc: string; created_at: Date; updated_at: Date };

function toGoal(r: GoalRow): Goal {
  const targetDate = r.target_date instanceof Date ? r.target_date.toISOString().slice(0, 10) : String(r.target_date).slice(0, 10);
  const priority = (GOAL_PRIORITIES as readonly string[]).includes(r.priority) ? (r.priority as GoalPriority) : "should";
  return { id: r.id, householdId: r.household_id, memberId: r.member_id, template: r.template, name: r.name, targetDate, priority, flexibilityYears: r.flexibility_years, payload: decryptJson<GoalPayload>(r.payload_enc), createdAt: r.created_at, updatedAt: r.updated_at };
}

export type GoalInput = { memberId?: string | null; template: string; name: string; targetDate: string; priority: GoalPriority; flexibilityYears: number; payload: unknown };

export async function listGoals(householdId: string): Promise<Goal[]> {
  const rows = await query<GoalRow>("SELECT * FROM goals WHERE household_id = ? AND archived_at IS NULL ORDER BY target_date, created_at", [householdId]);
  return rows.map(toGoal);
}

export async function getGoal(householdId: string, id: string): Promise<Goal | undefined> {
  const r = await one<GoalRow>("SELECT * FROM goals WHERE id = ? AND household_id = ? AND archived_at IS NULL", [id, householdId]);
  return r && toGoal(r);
}

export async function createGoal(householdId: string, actorUserId: string, input: GoalInput): Promise<Goal> {
  const payload = GOAL_PAYLOAD_SCHEMA.parse(input.payload);
  const id = newId();
  await execute(
    "INSERT INTO goals (id, household_id, member_id, template, name, target_date, priority, flexibility_years, payload_enc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, householdId, input.memberId ?? null, input.template, input.name.trim().slice(0, 120), input.targetDate, input.priority, input.flexibilityYears, encryptJson(payload)],
  );
  await audit(actorUserId, "goalCreated", "goal", id);
  return (await getGoal(householdId, id))!;
}

export async function updateGoal(householdId: string, actorUserId: string, id: string, input: GoalInput): Promise<Goal | undefined> {
  const existing = await getGoal(householdId, id);
  if (!existing) return undefined;
  const payload = GOAL_PAYLOAD_SCHEMA.parse(input.payload);
  await execute(
    "UPDATE goals SET member_id = ?, template = ?, name = ?, target_date = ?, priority = ?, flexibility_years = ?, payload_enc = ? WHERE id = ? AND household_id = ?",
    [input.memberId === undefined ? existing.memberId : input.memberId, input.template, input.name.trim().slice(0, 120), input.targetDate, input.priority, input.flexibilityYears, encryptJson(payload), id, householdId],
  );
  await audit(actorUserId, "goalUpdated", "goal", id);
  return getGoal(householdId, id);
}

export async function archiveGoal(householdId: string, actorUserId: string, id: string): Promise<void> {
  await execute("UPDATE goals SET archived_at = NOW() WHERE id = ? AND household_id = ? AND archived_at IS NULL", [id, householdId]);
  await audit(actorUserId, "goalArchived", "goal", id);
}
