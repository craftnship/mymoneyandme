import "server-only";
import { getPool, type Row } from "../db";

/**
 * Permanent erasure after the 30-day grace period (section 14). Everything the
 * member owns goes in one transaction; audit events stay for the security log
 * but lose their actor so nothing links back to the person. Called from the
 * cron route and opportunistically at sign-in.
 */
export const GRACE_DAYS = 30;

/** Deletes every account whose confirmed deletion request is older than the grace period; returns how many were removed. */
export async function purgeDueDeletions(now: Date = new Date()): Promise<number> {
  const pool = await getPool();
  const [due] = await pool.query<Row[]>(
    "SELECT id FROM users WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at < DATE_SUB(?, INTERVAL ? DAY)",
    [now, GRACE_DAYS],
  );
  let purged = 0;
  for (const row of due) {
    await purgeUser(String(row.id));
    purged += 1;
  }
  return purged;
}

export async function purgeUser(userId: string): Promise<void> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [households] = await conn.query<Row[]>("SELECT id FROM households WHERE owner_user_id = ?", [userId]);
    for (const h of households) {
      const hid = String(h.id);
      for (const table of ["monthly_snapshots", "plan_items", "checkups", "goals", "financial_items", "household_members"]) {
        await conn.query(`DELETE FROM ${table} WHERE household_id = ?`, [hid]);
      }
      await conn.query("DELETE FROM households WHERE id = ?", [hid]);
    }
    // Membership rows in another household (future invites) go too.
    await conn.query("DELETE FROM household_members WHERE user_id = ?", [userId]);
    for (const table of ["consents", "passkeys", "webauthn_challenges", "email_tokens", "sessions"]) {
      await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    }
    await conn.query("UPDATE audit_events SET actor_user_id = NULL WHERE actor_user_id = ?", [userId]);
    await conn.query("DELETE FROM users WHERE id = ?", [userId]);
    await conn.query("INSERT INTO audit_events (actor_user_id, action, entity, entity_id) VALUES (NULL, 'accountPurged', 'user', NULL)");
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
