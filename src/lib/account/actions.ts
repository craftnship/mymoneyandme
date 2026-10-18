"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { mailConfigured } from "../mail";
import { makeRateLimiter } from "../rateLimit";
import type { ActionState } from "../auth/actions";
import { getCurrentUser } from "../auth/current";
import { sendDeletionEmail } from "../auth/emails";
import { checkPassword, hashPassword, verifyPassword, PASSWORD_MAX } from "../auth/password";
import { revokeOtherSessions, revokeSession } from "../auth/session";
import { audit, CONSENT_KINDS, currentConsents, getPasswordHash, issueEmailToken, recordConsents, setPasswordHash, updateUser, type ConsentKind, type User } from "../auth/users";
import { deletePasskey, renamePasskey } from "../auth/webauthn";
import { profileSchema, riskSchema, scoreRisk } from "./profile";
import { clearDeletionRequest } from "./store";

/**
 * Settings Server Actions. Each one re-reads the session, validates the form
 * with zod and returns `{ error }` keyed into `appSettings.errors`, or `{ ok }`.
 * Nothing here accepts a user id from the client: the signed-in user is the
 * only account an action can touch.
 */
const localeSchema = z.enum(routing.locales as unknown as [string, ...string[]]).catch("en");
const idSchema = z.string().trim().min(1).max(255);
const deletionLimiter = makeRateLimiter(3, 60 * 60 * 1000);

async function signedIn(): Promise<User | null> {
  return getCurrentUser();
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const parsed = profileSchema.safeParse({
    name: str(form, "name"), preferredName: str(form, "preferredName"), dob: str(form, "dob"), gender: str(form, "gender"), maritalStatus: str(form, "maritalStatus"),
    city: str(form, "city"), state: str(form, "state"), pin: str(form, "pin"), cityTier: str(form, "cityTier") || "1", locale: str(form, "displayLocale") || user.locale,
    numberFormat: str(form, "numberFormat") || "indian", employment: str(form, "employment") || "salaried", retirementAge: str(form, "retirementAge"),
    smoker: str(form, "smoker"), existingConditions: str(form, "existingConditions"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "");
    const named = ["name", "dob", "pin", "retirementAge"];
    return { error: named.includes(field) ? field : "invalid" };
  }
  const p = parsed.data;
  await updateUser(user.id, {
    name: p.name, preferred_name: p.preferredName, dob: p.dob, gender: p.gender, marital_status: p.maritalStatus, city: p.city, state: p.state, pin: p.pin,
    city_tier: Number(p.cityTier), locale: p.locale, number_format: p.numberFormat, employment: p.employment, retirement_age: p.retirementAge,
    smoker: p.smoker === null ? null : p.smoker ? 1 : 0, existing_conditions: p.existingConditions === null ? null : p.existingConditions ? 1 : 0,
  });
  await audit(user.id, "profileUpdated", "user", user.id);
  if (p.locale !== user.locale) {
    // The display language changed: land in the new language so the whole app follows.
    redirect(`/${p.locale}/app/settings?status=language`);
  }
  refresh();
  return { ok: true };
}

export async function saveRiskProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const locale = localeSchema.parse(form.get("locale"));
  const parsed = riskSchema.safeParse({ horizon: str(form, "horizon"), drop: str(form, "drop"), experience: str(form, "experience"), income: str(form, "income"), priority: str(form, "priority") });
  if (!parsed.success) return { error: "riskIncomplete" };
  const profile = scoreRisk(parsed.data);
  await updateUser(user.id, { risk_profile: profile });
  await audit(user.id, "riskProfileSet", "user", user.id);
  redirect(`/${locale}/app/settings/risk?result=${profile}`);
}

export async function changePassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const current = str(form, "currentPassword");
  const next = str(form, "newPassword");
  const hash = await getPasswordHash(user.id);
  if (!hash) return { error: "noPassword" };
  if (!current || !(await verifyPassword(current, hash))) {
    await audit(user.id, "passwordChangeFailed", "user", user.id);
    return { error: "wrongPassword" };
  }
  if (next.length > PASSWORD_MAX) return { error: "password.tooLong" };
  if (next === current) return { error: "samePassword" };
  const problem = await checkPassword(next);
  if (problem) return { error: `password.${problem}` };
  await setPasswordHash(user.id, await hashPassword(next));
  await revokeOtherSessions(user.id);
  await audit(user.id, "passwordChanged", "user", user.id);
  refresh();
  return { ok: true };
}

export async function revokeSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const id = idSchema.safeParse(form.get("sessionId"));
  if (!id.success) return { error: "invalid" };
  await revokeSession(user.id, id.data);
  await audit(user.id, "sessionRevoked", "session", id.data);
  refresh();
  return { ok: true };
}

export async function signOutElsewhere(_prev: ActionState, form: FormData): Promise<ActionState> {
  void form;
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  await revokeOtherSessions(user.id);
  await audit(user.id, "otherSessionsRevoked", "user", user.id);
  refresh();
  return { ok: true };
}

export async function renamePasskeyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const id = idSchema.safeParse(form.get("passkeyId"));
  const name = z.string().trim().min(1).max(100).safeParse(form.get("name"));
  if (!id.success || !name.success) return { error: "passkeyName" };
  await renamePasskey(user.id, id.data, name.data);
  await audit(user.id, "passkeyRenamed", "passkey", id.data);
  refresh();
  return { ok: true };
}

export async function removePasskeyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const id = idSchema.safeParse(form.get("passkeyId"));
  if (!id.success) return { error: "invalid" };
  await deletePasskey(user.id, id.data);
  refresh();
  return { ok: true };
}

export async function updateConsents(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const before = await currentConsents(user.id);
  const decided = new Set((str(form, "decided") || "").split(",").filter(Boolean));
  const changes: Partial<Record<ConsentKind, boolean>> = {};
  for (const kind of CONSENT_KINDS) {
    const granted = form.get(kind) === "on";
    // Append a row only when the decision is new or different, so the history stays meaningful.
    if (!decided.has(kind) || before[kind] !== granted) changes[kind] = granted;
  }
  await recordConsents(user.id, changes);
  await audit(user.id, "consentsUpdated", "user", user.id);
  refresh();
  return { ok: true };
}

export async function requestDeletion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  const locale = localeSchema.parse(form.get("locale"));
  if (form.get("confirm") !== "on") return { error: "confirmRequired" };
  if (!mailConfigured()) return { error: "notConfigured" };
  if (!(await deletionLimiter(`delete:${user.id}`))) return { error: "rateLimited" };
  const token = await issueEmailToken(user.id, "delete", 24);
  try {
    await sendDeletionEmail(user.email, locale, token);
  } catch {
    return { error: "mailFailed" };
  }
  await audit(user.id, "deletionRequested", "user", user.id);
  return { ok: true };
}

export async function cancelDeletion(_prev: ActionState, form: FormData): Promise<ActionState> {
  void form;
  const user = await signedIn();
  if (!user) return { error: "signedOut" };
  if (user.deletionRequestedAt) {
    await clearDeletionRequest(user.id);
    await audit(user.id, "deletionCancelled", "user", user.id);
  }
  refresh();
  return { ok: true };
}
