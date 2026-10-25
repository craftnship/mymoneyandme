import "server-only";
import { cache } from "react";
import { requireUser } from "./current";
import { currentAuthMethod } from "./session";
import { audit, setRole, type User } from "./users";
import { adminEmails, decideAdminAccess, type StaffRole } from "./roles";

export type AdminAccess = { ok: true; user: User; role: StaffRole } | { ok: false; user: User; reason: "notStaff" | "needsPasskey" };

/**
 * Who may use the authoring console, checked on the server for every admin
 * page and action. Redirects to sign-in when nobody is signed in; must run
 * inside <Suspense> or a Server Action, like requireUser.
 */
export const adminAccess = cache(async (locale: string): Promise<AdminAccess> => {
  const user = await requireUser(locale, `/${locale}/admin`);
  const decision = decideAdminAccess({ email: user.email, emailVerified: Boolean(user.emailVerifiedAt), role: user.role }, await currentAuthMethod(), adminEmails());
  if (decision.promote) await promote(user);
  if (!decision.ok) return { ok: false, user, reason: decision.reason };
  return { ok: true, user: { ...user, role: decision.role }, role: decision.role };
});

async function promote(user: User) {
  await setRole(user.id, "admin");
  await audit(user.id, "roleGranted", "user", user.id);
}

/** For Server Actions: throws instead of rendering a notice. */
export async function requireStaff(locale: string): Promise<{ user: User; role: StaffRole }> {
  const access = await adminAccess(locale);
  if (!access.ok) throw new Error(access.reason);
  return access;
}
