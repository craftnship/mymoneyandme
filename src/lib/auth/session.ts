import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { execute, newId, one, query, type Row } from "../db";
import { randomToken, sha256 } from "../db/crypto";
import { SESSION_COOKIE } from "./cookie";

/**
 * Database-backed sessions (section 14): opaque token in an httpOnly cookie,
 * only its hash stored; 30-minute idle timeout and a 30-day absolute limit.
 * The idle clock is refreshed at most every five minutes to keep reads cheap.
 */
export { SESSION_COOKIE };
export const IDLE_MINUTES = 30;
const ABSOLUTE_DAYS = 30;
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type SessionInfo = { id: string; userAgent: string | null; ip: string | null; createdAt: Date; lastSeenAt: Date; current: boolean };

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const h = await headers();
  const id = newId();
  await execute(
    "INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))",
    [id, userId, sha256(token), (h.get("user-agent") ?? "").slice(0, 255) || null, (h.get("x-forwarded-for")?.split(",")[0].trim() ?? "").slice(0, 64) || null, ABSOLUTE_DAYS],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ABSOLUTE_DAYS * 24 * 3600,
  });
}

/** Returns the user id behind the request's cookie, or null when there is no live session. */
export async function getSessionUserId(): Promise<string | null> {
  // Session state is request-only: never part of a prerendered or prefetched shell.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<Row & { id: string; user_id: string; last_seen_at: Date; expires_at: Date; deletion_requested_at: Date | null }>(
    "SELECT s.id, s.user_id, s.last_seen_at, s.expires_at, u.deletion_requested_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    [sha256(token)],
  );
  if (!row) return null;
  const now = Date.now();
  const idleFor = now - new Date(row.last_seen_at).getTime();
  if (now > new Date(row.expires_at).getTime() || idleFor > IDLE_MINUTES * 60 * 1000) {
    await execute("DELETE FROM sessions WHERE id = ?", [row.id]);
    return null;
  }
  if (idleFor > TOUCH_EVERY_MS) await execute("UPDATE sessions SET last_seen_at = NOW() WHERE id = ?", [row.id]);
  return row.user_id;
}

export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<Row & { id: string }>("SELECT id FROM sessions WHERE token_hash = ?", [sha256(token)]);
  return row?.id ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function listSessions(userId: string): Promise<SessionInfo[]> {
  const current = await currentSessionId();
  const rows = await query<Row & { id: string; user_agent: string | null; ip: string | null; created_at: Date; last_seen_at: Date }>(
    "SELECT id, user_agent, ip, created_at, last_seen_at FROM sessions WHERE user_id = ? AND expires_at > NOW() ORDER BY last_seen_at DESC",
    [userId],
  );
  return rows.map((r) => ({ id: r.id, userAgent: r.user_agent, ip: r.ip, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === current }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
}

export async function revokeOtherSessions(userId: string): Promise<void> {
  const current = await currentSessionId();
  await execute("DELETE FROM sessions WHERE user_id = ? AND id <> ?", [userId, current ?? ""]);
}

/** Signs the user out everywhere, including this device (used after a password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
}
