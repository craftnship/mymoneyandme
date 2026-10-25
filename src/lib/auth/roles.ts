import type { AuthMethod } from "./session";

/**
 * Staff roles for the authoring console. `users.role` defaults to 'member';
 * 'admin' can do everything, 'editor' works on content only. The first admin
 * comes from ADMIN_EMAILS (comma-separated): a verified account with one of
 * those addresses is promoted the next time it opens the admin.
 */
export type StaffRole = "admin" | "editor";

export function isStaff(role: string): role is StaffRole {
  return role === "admin" || role === "editor";
}

export function adminEmails(raw = process.env.ADMIN_EMAILS ?? ""): Set<string> {
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export type AdminDecision =
  | { ok: true; role: StaffRole; promote: boolean }
  | { ok: false; reason: "notStaff" | "needsPasskey"; promote: boolean };

/**
 * Pure access rule. A promotion needs a verified email, so nobody can claim
 * an admin address by signing up with it first. Staff must have signed in
 * with a passkey this session: a leaked password alone never opens the admin.
 * The promotion is applied even when the passkey is missing, so the role is
 * in place for the passkey sign-in that follows.
 */
export function decideAdminAccess(user: { email: string; emailVerified: boolean; role: string }, method: AuthMethod | null, admins: Set<string>): AdminDecision {
  const promote = !isStaff(user.role) && user.emailVerified && admins.has(user.email.toLowerCase());
  const role = promote ? "admin" : user.role;
  if (!isStaff(role)) return { ok: false, reason: "notStaff", promote };
  if (method !== "passkey") return { ok: false, reason: "needsPasskey", promote };
  return { ok: true, role, promote };
}
