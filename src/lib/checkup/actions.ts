"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { getCurrentHousehold, getCurrentUser } from "../auth/current";
import { audit } from "../auth/users";
import { runAndStoreCheckUp } from "./store";
import { setPlanItemStatus } from "./planStore";
import { PLAN_STATUSES } from "./progress";

/**
 * Check-up and plan Server Actions. Each one re-reads the session, scopes the
 * write to the signed-in household and redirects back to the page it came
 * from so the form works without client JavaScript.
 */
export type CheckUpActionState = { error?: string; ok?: boolean };

const localeSchema = z.enum(routing.locales as unknown as [string, ...string[]]).catch("en");
const itemIdSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);
const statusSchema = z.enum(PLAN_STATUSES);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function runCheckUpAction(_prev: CheckUpActionState, form: FormData): Promise<CheckUpActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) return { error: "signedOut" };
  const household = await getCurrentHousehold(user.id);
  let id: string;
  try {
    ({ id } = await runAndStoreCheckUp(household.id, user.id));
  } catch {
    return { error: "generic" };
  }
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/check-up?ran=${encodeURIComponent(id)}`);
}

export async function setPlanStatusAction(_prev: CheckUpActionState, form: FormData): Promise<CheckUpActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) return { error: "signedOut" };
  const household = await getCurrentHousehold(user.id);
  const itemId = itemIdSchema.safeParse(form.get("itemId"));
  const status = statusSchema.safeParse(form.get("status"));
  if (!itemId.success || !status.success) return { error: "generic" };
  const skipReason = String(form.get("skipReason") ?? "").trim();
  if (status.data === "skipped" && !skipReason) return { error: "skipReasonRequired" };
  let snoozedUntil: string | null = null;
  if (status.data === "snoozed") {
    const parsed = dateSchema.safeParse(form.get("snoozedUntil"));
    const today = new Date().toISOString().slice(0, 10);
    if (!parsed.success || parsed.data <= today) return { error: "snoozeDateInvalid" };
    snoozedUntil = parsed.data;
  }
  await setPlanItemStatus(household.id, itemId.data, status.data, skipReason || null, snoozedUntil);
  await audit(user.id, `plan.${status.data}`, "planItem", itemId.data);
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/plan#item-${itemId.data}`);
}
