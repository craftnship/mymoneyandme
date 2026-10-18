import "server-only";
import { execute, query, type Row } from "../db";
import { buildPlan } from "./plan";
import { latestCheckUp, type StoredCheckUp } from "./store";
import { PLAN_STATUSES, type PlanItemState, type PlanItemWithStatus, type PlanStatus } from "./progress";

/**
 * Plan persistence (section 11). The checklist itself is rebuilt from the
 * latest check-up on every read, so it always reflects the current numbers;
 * only each item's status lives in plan_items, keyed by the stable item id,
 * which is how completed items stay done across re-runs.
 */
type PlanRow = Row & { item_id: string; status: string; skip_reason: string | null; snoozed_until: Date | string | null; updated_at: Date };

function toState(r: PlanRow | undefined): PlanItemState {
  if (!r) return { status: "todo", skipReason: null, snoozedUntil: null, updatedAt: null };
  const status = (PLAN_STATUSES as readonly string[]).includes(r.status) ? (r.status as PlanStatus) : "todo";
  const snoozedUntil = r.snoozed_until instanceof Date ? r.snoozed_until.toISOString().slice(0, 10) : r.snoozed_until ? String(r.snoozed_until).slice(0, 10) : null;
  return { status, skipReason: r.skip_reason, snoozedUntil, updatedAt: r.updated_at };
}

export type HouseholdPlan = { checkup: StoredCheckUp; items: PlanItemWithStatus[] };

export async function planForHousehold(householdId: string): Promise<HouseholdPlan | undefined> {
  const checkup = await latestCheckUp(householdId);
  if (!checkup) return undefined;
  const rows = await query<PlanRow>("SELECT item_id, status, skip_reason, snoozed_until, updated_at FROM plan_items WHERE household_id = ?", [householdId]);
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  const items = buildPlan(checkup.result, checkup.snapshot.monthlyIncome).map((item) => ({ ...item, ...toState(byId.get(item.id)) }));
  return { checkup, items };
}

export async function setPlanItemStatus(householdId: string, itemId: string, status: PlanStatus, skipReason?: string | null, snoozedUntil?: string | null): Promise<void> {
  const reason = status === "skipped" ? (skipReason ?? "").trim().slice(0, 255) || null : null;
  const until = status === "snoozed" ? snoozedUntil ?? null : null;
  await execute(
    "INSERT INTO plan_items (household_id, item_id, status, skip_reason, snoozed_until) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), skip_reason = VALUES(skip_reason), snoozed_until = VALUES(snoozed_until)",
    [householdId, itemId.slice(0, 60), status, reason, until],
  );
}
