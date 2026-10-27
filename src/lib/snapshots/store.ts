import "server-only";
import { execute, newId, query, type Row } from "../db";
import { decryptJson, encryptJson } from "../db/crypto";
import { findUserById } from "../auth/users";
import { listItems, listMembers } from "../data/store";
import { listGoals } from "../goals/store";
import { computeMoneySnapshot, monthOf, type MoneySnapshot } from "./compute";

/**
 * Monthly snapshots (spec section 7): one encrypted row per household and
 * month, rewritten whenever the household's data changes and once more by the
 * monthly cron so a quiet month still gets its row. Only the month is in clear,
 * so trends can be listed without decrypting more than the rows shown.
 */
type SnapshotRow = Row & { id: string; household_id: string; month: string; payload_enc: string; created_at: Date; updated_at: Date };

export type StoredSnapshot = { id: string; month: string; snapshot: MoneySnapshot; updatedAt: Date };

function toStored(r: SnapshotRow): StoredSnapshot {
  return { id: r.id, month: r.month, snapshot: decryptJson<MoneySnapshot>(r.payload_enc), updatedAt: r.updated_at };
}

/** Recomputes and stores this month's snapshot for a household. Returns undefined when the owner has no data at all. */
export async function recordMonthlySnapshot(householdId: string, ownerUserId: string, now = new Date()): Promise<MoneySnapshot | undefined> {
  const user = await findUserById(ownerUserId);
  if (!user) return undefined;
  const [members, items, goals] = await Promise.all([listMembers(householdId), listItems(householdId), listGoals(householdId)]);
  if (!items.length) return undefined;
  const snapshot = computeMoneySnapshot(user, members, items, goals, now);
  await execute(
    "INSERT INTO monthly_snapshots (id, household_id, month, payload_enc) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload_enc = VALUES(payload_enc)",
    [newId(), householdId, snapshot.month, encryptJson(snapshot)],
  );
  return snapshot;
}

/** Best effort after a data change: a snapshot failure must never fail the save that caused it. */
export async function refreshSnapshot(householdId: string, ownerUserId: string): Promise<void> {
  try {
    await recordMonthlySnapshot(householdId, ownerUserId);
  } catch (err) {
    console.error("monthly snapshot not refreshed", err);
  }
}

/** Newest first. */
export async function listSnapshots(householdId: string, limit = 24): Promise<StoredSnapshot[]> {
  const rows = await query<SnapshotRow>("SELECT * FROM monthly_snapshots WHERE household_id = ? ORDER BY month DESC LIMIT ?", [householdId, limit]);
  return rows.map(toStored);
}

/** This month's row and the newest earlier one, for the "since last month" comparison. */
export async function currentAndPrevious(householdId: string, now = new Date()): Promise<{ current?: StoredSnapshot; previous?: StoredSnapshot }> {
  const month = monthOf(now);
  const rows = await listSnapshots(householdId, 2);
  const current = rows.find((r) => r.month === month);
  const previous = rows.find((r) => r.month < month);
  return { current, previous };
}

/** The monthly cron: every household with data gets this month's row. Households already written this month are skipped. */
export async function recordSnapshotsForAllHouseholds(now = new Date(), limit = 1000): Promise<{ written: number; skipped: number }> {
  const month = monthOf(now);
  const due = await query<Row & { id: string; owner_user_id: string }>(
    `SELECT h.id, h.owner_user_id FROM households h
     JOIN users u ON u.id = h.owner_user_id AND u.deletion_requested_at IS NULL
     WHERE EXISTS (SELECT 1 FROM financial_items f WHERE f.household_id = h.id AND f.archived_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM monthly_snapshots s WHERE s.household_id = h.id AND s.month = ?)
     LIMIT ?`,
    [month, limit],
  );
  let written = 0;
  let skipped = 0;
  for (const h of due) {
    try {
      if (await recordMonthlySnapshot(String(h.id), String(h.owner_user_id), now)) written += 1;
      else skipped += 1;
    } catch (err) {
      console.error("monthly snapshot failed", h.id, err);
      skipped += 1;
    }
  }
  return { written, skipped };
}
