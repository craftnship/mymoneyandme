import "server-only";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getSessionUserId } from "./session";
import { findUserById, householdForUser, type User } from "./users";

/**
 * Request-scoped view of who is signed in. Reads the session cookie, so it must
 * only be called inside a <Suspense> boundary or a Server Action (Cache
 * Components rule); layouts must not call it at their top level.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return (await findUserById(userId)) ?? null;
});

/** Redirects to the localised sign-in page when nobody is signed in. */
export async function requireUser(locale: string, next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: { pathname: "/app/sign-in", query: next ? { next } : undefined }, locale });
    throw new Error("unreachable");
  }
  return user;
}

export const getCurrentHousehold = cache(async (userId: string) => {
  const h = await householdForUser(userId);
  if (!h) throw new Error("Household missing for user");
  return h;
});

export async function requireHousehold(locale: string, next?: string): Promise<{ user: User; household: { id: string; name: string } }> {
  const user = await requireUser(locale, next);
  const household = await getCurrentHousehold(user.id);
  return { user, household };
}
