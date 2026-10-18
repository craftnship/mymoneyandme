"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { databaseConfigured } from "../db";
import { encryptionConfigured } from "../db/crypto";
import { mailConfigured } from "../mail";
import { makeRateLimiter } from "../rateLimit";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emails";
import { checkPassword, hashPassword, verifyPassword, PASSWORD_MAX } from "./password";
import { createSession, destroyCurrentSession, revokeAllSessions } from "./session";
import {
  audit, clearLoginFailures, consumeEmailToken, createUser, findUserByEmail, findUserById, getPasswordHash, isLocked, issueEmailToken,
  markEmailVerified, recordConsents, recordLoginFailure, setPasswordHash,
} from "./users";
import { getCurrentUser } from "./current";
import { purgeDueDeletions } from "../account/purge";
import { clearDeletionRequest } from "../account/store";

/**
 * Account Server Actions. Every action re-checks the session itself and returns
 * a plain `{ error }` object for useActionState; redirects happen here so the
 * client never has to know where to go next.
 */
export type ActionState = { error?: string; ok?: boolean; email?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const localeSchema = z.enum(routing.locales as unknown as [string, ...string[]]).catch("en");
// Only same-site paths may be used as a post-login destination (open-redirect guard).
const nextSchema = z.string().regex(/^\/(?!\/)[\w\-./?=&%]*$/).max(200).catch("");

const signInLimiter = makeRateLimiter(10, 15 * 60 * 1000);
const signUpLimiter = makeRateLimiter(5, 60 * 60 * 1000);
const resetLimiter = makeRateLimiter(3, 60 * 60 * 1000);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

function appPath(locale: string, path = "/app") {
  return `/${locale}${path}`;
}

function ready(): string | null {
  if (!databaseConfigured()) return "notConfigured";
  if (!encryptionConfigured()) return "notConfigured";
  return null;
}

export async function signUp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const notReady = ready();
  if (notReady) return { error: notReady };
  const locale = localeSchema.parse(form.get("locale"));
  const email = emailSchema.safeParse(form.get("email"));
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const terms = form.get("terms") === "on";
  if (!email.success) return { error: "invalidEmail" };
  if (name.length < 1 || name.length > 100) return { error: "invalidName" };
  if (!terms) return { error: "termsRequired" };
  if (password.length > PASSWORD_MAX) return { error: "password.tooLong" };
  const problem = await checkPassword(password);
  if (problem) return { error: `password.${problem}` };
  if (!(await signUpLimiter(`signup:${await clientIp()}`))) return { error: "rateLimited" };

  if (await findUserByEmail(email.data)) {
    // Do not reveal whether the address exists; behave as if it worked and nudge towards sign-in by email.
    return { ok: true, email: email.data };
  }
  const user = await createUser({ email: email.data, passwordHash: await hashPassword(password), name, locale });
  await recordConsents(user.id, { analytics: form.get("analytics") === "on", marketing: form.get("marketing") === "on" });
  await audit(user.id, "signUp", "user", user.id);
  if (mailConfigured()) {
    const token = await issueEmailToken(user.id, "verify", 48);
    await sendVerificationEmail(user.email, locale, token).catch(() => undefined);
  }
  await createSession(user.id);
  redirect(appPath(locale, "/app/welcome"));
}

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const notReady = ready();
  if (notReady) return { error: notReady };
  const locale = localeSchema.parse(form.get("locale"));
  const next = nextSchema.parse(form.get("next"));
  const email = emailSchema.safeParse(form.get("email"));
  const password = String(form.get("password") ?? "");
  if (!email.success || !password) return { error: "invalidCredentials" };
  if (!(await signInLimiter(`signin:${await clientIp()}:${email.data}`))) return { error: "rateLimited" };

  // Accounts past their 30-day deletion grace are purged before any lookup, so they can no longer sign in.
  await purgeDueDeletions().catch(() => undefined);
  const user = await findUserByEmail(email.data);
  const hash = user ? await getPasswordHash(user.id) : null;
  if (!user || !hash) {
    // Burn the same time as a real check so timing does not reveal registered addresses.
    await verifyPassword(password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").catch(() => false);
    return { error: "invalidCredentials" };
  }
  if (await isLocked(user.id)) return { error: "locked" };
  if (!(await verifyPassword(password, hash))) {
    await recordLoginFailure(user.id);
    await audit(user.id, "signInFailed", "user", user.id);
    return { error: "invalidCredentials" };
  }
  await clearLoginFailures(user.id);
  // Signing in during the grace period cancels a pending deletion, as the confirmation email promises.
  if (user.deletionRequestedAt) await clearDeletionRequest(user.id);
  await createSession(user.id);
  await audit(user.id, "signIn", "user", user.id);
  redirect(next && next.startsWith(`/${locale}/app`) ? next : appPath(locale));
}

export async function signOut(form: FormData): Promise<void> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit(user.id, "signOut", "user", user.id);
  redirect(`/${locale}`);
}

export async function requestPasswordReset(_prev: ActionState, form: FormData): Promise<ActionState> {
  const notReady = ready();
  if (notReady) return { error: notReady };
  const locale = localeSchema.parse(form.get("locale"));
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidEmail" };
  if (!(await resetLimiter(`reset:${email.data}`))) return { ok: true };
  const user = await findUserByEmail(email.data);
  if (user && mailConfigured()) {
    const token = await issueEmailToken(user.id, "reset", 1);
    await sendPasswordResetEmail(user.email, locale, token).catch(() => undefined);
    await audit(user.id, "resetRequested", "user", user.id);
  }
  // Always report success so the form cannot be used to probe for accounts.
  return { ok: true };
}

export async function resetPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const notReady = ready();
  if (notReady) return { error: notReady };
  const locale = localeSchema.parse(form.get("locale"));
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (!token) return { error: "invalidToken" };
  if (password.length > PASSWORD_MAX) return { error: "password.tooLong" };
  const problem = await checkPassword(password);
  if (problem) return { error: `password.${problem}` };
  const userId = await consumeEmailToken(token, "reset");
  if (!userId) return { error: "invalidToken" };
  await setPasswordHash(userId, await hashPassword(password));
  await markEmailVerified(userId); // the link proved control of the mailbox
  await clearLoginFailures(userId);
  await revokeAllSessions(userId);
  await audit(userId, "passwordReset", "user", userId);
  const user = await findUserById(userId);
  if (user) await createSession(user.id);
  redirect(appPath(locale));
}

export async function resendVerification(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "signedOut" };
  if (user.emailVerifiedAt) return { ok: true };
  if (!mailConfigured()) return { error: "notConfigured" };
  if (!(await resetLimiter(`verify:${user.id}`))) return { error: "rateLimited" };
  const token = await issueEmailToken(user.id, "verify", 48);
  await sendVerificationEmail(user.email, user.locale, token).catch(() => undefined);
  return { ok: true };
}
