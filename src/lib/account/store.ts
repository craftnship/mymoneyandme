import "server-only";
import { execute, one, query, type Row } from "../db";
import type { ConsentKind } from "../auth/users";

/**
 * Account-settings reads that the shared user repository does not expose:
 * the optional health flags and the dates behind the consent history.
 */
export type HealthFlags = { smoker: boolean | null; existingConditions: boolean | null };

export async function getHealthFlags(userId: string): Promise<HealthFlags> {
  const r = await one<Row & { smoker: number | null; existing_conditions: number | null }>("SELECT smoker, existing_conditions FROM users WHERE id = ?", [userId]);
  return { smoker: r?.smoker == null ? null : Boolean(r.smoker), existingConditions: r?.existing_conditions == null ? null : Boolean(r.existing_conditions) };
}

/** When each consent kind was last decided (append-only history; the latest row is the decision in force). */
export async function consentDecidedAt(userId: string): Promise<Partial<Record<ConsentKind, Date>>> {
  const rows = await query<Row & { kind: ConsentKind; recorded_at: Date }>("SELECT kind, MAX(recorded_at) AS recorded_at FROM consents WHERE user_id = ? GROUP BY kind", [userId]);
  const out: Partial<Record<ConsentKind, Date>> = {};
  for (const r of rows) out[r.kind] = r.recorded_at;
  return out;
}

export async function clearDeletionRequest(userId: string): Promise<void> {
  await execute("UPDATE users SET deletion_requested_at = NULL WHERE id = ?", [userId]);
}
