import "server-only";
import { execute, newId, one, query, type Row } from "../db";
import { randomToken, sha256 } from "../db/crypto";

export type EmploymentType = "salaried" | "selfEmployed" | "business" | "retired" | "student" | "homemaker";

export type User = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  name: string;
  preferredName: string | null;
  dob: string | null; // YYYY-MM-DD
  gender: string | null;
  maritalStatus: string | null;
  dependants: number;
  city: string | null;
  state: string | null;
  pin: string | null;
  cityTier: 1 | 2 | 3;
  locale: string;
  numberFormat: "indian" | "international";
  employment: EmploymentType;
  retirementAge: number | null;
  riskProfile: string | null;
  role: string;
  deletionRequestedAt: Date | null;
  createdAt: Date;
};

type UserRow = Row & {
  id: string; email: string; email_verified_at: Date | null; name: string; preferred_name: string | null; dob: Date | string | null; gender: string | null;
  marital_status: string | null; dependants: number; city: string | null; state: string | null; pin: string | null; city_tier: number; locale: string;
  number_format: string; employment: string; retirement_age: number | null; risk_profile: string | null; role: string; deletion_requested_at: Date | null; created_at: Date;
};

const COLS = "id, email, email_verified_at, name, preferred_name, dob, gender, marital_status, dependants, city, state, pin, city_tier, locale, number_format, employment, retirement_age, risk_profile, role, deletion_requested_at, created_at";

function toUser(r: UserRow): User {
  const dob = r.dob instanceof Date ? r.dob.toISOString().slice(0, 10) : r.dob ? String(r.dob).slice(0, 10) : null;
  return {
    id: r.id, email: r.email, emailVerifiedAt: r.email_verified_at, name: r.name, preferredName: r.preferred_name, dob, gender: r.gender,
    maritalStatus: r.marital_status, dependants: r.dependants, city: r.city, state: r.state, pin: r.pin, cityTier: (r.city_tier as 1 | 2 | 3) || 1,
    locale: r.locale, numberFormat: r.number_format === "international" ? "international" : "indian", employment: r.employment as EmploymentType,
    retirementAge: r.retirement_age, riskProfile: r.risk_profile, role: r.role, deletionRequestedAt: r.deletion_requested_at, createdAt: r.created_at,
  };
}

export async function findUserById(id: string): Promise<User | undefined> {
  const r = await one<UserRow>(`SELECT ${COLS} FROM users WHERE id = ?`, [id]);
  return r && toUser(r);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const r = await one<UserRow>(`SELECT ${COLS} FROM users WHERE email = ?`, [email.trim().toLowerCase()]);
  return r && toUser(r);
}

/** Creates the user and their household (one household per owner; invites come later). */
export async function createUser(input: { email: string; passwordHash: string | null; name: string; locale: string }): Promise<User> {
  const id = newId();
  await execute("INSERT INTO users (id, email, password_hash, name, locale) VALUES (?, ?, ?, ?, ?)", [id, input.email.trim().toLowerCase(), input.passwordHash, input.name.trim().slice(0, 100), input.locale]);
  const householdId = newId();
  await execute("INSERT INTO households (id, owner_user_id, name) VALUES (?, ?, ?)", [householdId, id, input.name.trim().slice(0, 120)]);
  await execute("INSERT INTO household_members (id, household_id, user_id, name, relation, earns, dependant) VALUES (?, ?, ?, ?, 'self', 1, 0)", [newId(), householdId, id, input.name.trim().slice(0, 100)]);
  return (await findUserById(id))!;
}

export async function updateUser(id: string, fields: Partial<Record<"name" | "preferred_name" | "dob" | "gender" | "marital_status" | "dependants" | "city" | "state" | "pin" | "city_tier" | "locale" | "number_format" | "employment" | "retirement_age" | "risk_profile" | "smoker" | "existing_conditions", string | number | null>>): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await execute(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...keys.map((k) => fields[k as keyof typeof fields] ?? null), id]);
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const r = await one<Row & { password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", [userId]);
  return r?.password_hash ?? null;
}

export async function setPasswordHash(userId: string, hash: string): Promise<void> {
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
}

/** Login lockout: 10 failures lock the account for 15 minutes (section 14). */
export async function recordLoginFailure(userId: string): Promise<void> {
  // MySQL applies SET clauses left to right, so the lock test must read the counter before it is incremented.
  await execute("UPDATE users SET locked_until = IF(failed_logins + 1 >= 10, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until), failed_logins = failed_logins + 1 WHERE id = ?", [userId]);
}

export async function clearLoginFailures(userId: string): Promise<void> {
  await execute("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", [userId]);
}

export async function isLocked(userId: string): Promise<boolean> {
  const r = await one<Row & { locked: number }>("SELECT (locked_until IS NOT NULL AND locked_until > NOW()) AS locked FROM users WHERE id = ?", [userId]);
  return Boolean(r?.locked);
}

export type TokenPurpose = "verify" | "reset" | "delete";

export async function issueEmailToken(userId: string, purpose: TokenPurpose, hours = 24): Promise<string> {
  const token = randomToken(32);
  await execute("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?", [userId, purpose]);
  await execute("INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))", [sha256(token), userId, purpose, hours]);
  return token;
}

/** Consumes a token once; returns the user id it belongs to, or null. */
export async function consumeEmailToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const r = await one<Row & { user_id: string }>("SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()", [sha256(token), purpose]);
  if (!r) return null;
  await execute("UPDATE email_tokens SET used_at = NOW() WHERE token_hash = ?", [sha256(token)]);
  return r.user_id;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await execute("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [userId]);
}

export type ConsentKind = "analytics" | "marketing" | "peerComparison" | "personalisation";
export const CONSENT_KINDS: ConsentKind[] = ["analytics", "marketing", "peerComparison", "personalisation"];

export async function recordConsents(userId: string, consents: Partial<Record<ConsentKind, boolean>>): Promise<void> {
  for (const kind of CONSENT_KINDS) {
    if (consents[kind] === undefined) continue;
    await execute("INSERT INTO consents (user_id, kind, granted) VALUES (?, ?, ?)", [userId, kind, consents[kind] ? 1 : 0]);
  }
}

/** Latest decision per consent kind. */
export async function currentConsents(userId: string): Promise<Record<ConsentKind, boolean>> {
  const rows = await query<Row & { kind: ConsentKind; granted: number }>("SELECT kind, granted FROM consents WHERE user_id = ? ORDER BY recorded_at ASC, id ASC", [userId]);
  const out: Record<ConsentKind, boolean> = { analytics: false, marketing: false, peerComparison: false, personalisation: false };
  for (const r of rows) out[r.kind] = Boolean(r.granted);
  return out;
}

export async function householdForUser(userId: string): Promise<{ id: string; name: string } | undefined> {
  return one<Row & { id: string; name: string }>("SELECT id, name FROM households WHERE owner_user_id = ?", [userId]);
}

export async function audit(actorUserId: string | null, action: string, entity: string, entityId?: string): Promise<void> {
  await execute("INSERT INTO audit_events (actor_user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)", [actorUserId, action, entity, entityId ?? null]);
}
