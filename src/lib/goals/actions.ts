"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { getCurrentHousehold, getCurrentUser } from "../auth/current";
import { listMembers } from "../data/store";
import { GOAL_PAYLOAD_SCHEMA, GOAL_PRIORITIES } from "./model";
import { archiveGoal, createGoal, getGoal, updateGoal } from "./store";
import { GOAL_TEMPLATE_KEYS } from "./templates";

/**
 * Goal Server Actions (section 10). Every field is validated with zod, the
 * member link is checked against the household's own members and writes are
 * scoped to the signed-in household.
 */
export type GoalActionState = { error?: string; ok?: boolean };

const localeSchema = z.enum(routing.locales as unknown as [string, ...string[]]).catch("en");
const idSchema = z.string().regex(/^[0-9a-f-]{36}$/);

const goalFormSchema = z.object({
  template: z.enum(GOAL_TEMPLATE_KEYS as [string, ...string[]]),
  name: z.string().trim().min(1).max(120),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.enum(GOAL_PRIORITIES),
  flexibilityYears: z.coerce.number().int().min(0).max(10).default(0),
  memberId: z.string().max(36).optional().or(z.literal("").transform(() => undefined)),
});

function fieldError(issue: z.core.$ZodIssue | undefined): string {
  const path = issue?.path?.[0];
  switch (path) {
    case "name": return "nameInvalid";
    case "targetDate": return "dateInvalid";
    case "targetToday": return "amountInvalid";
    case "inflationPct": return "inflationInvalid";
    case "assignedAmount": return "amountInvalid";
    case "monthlySip": return "amountInvalid";
    default: return "generic";
  }
}

async function parseGoalForm(householdId: string, form: FormData) {
  const base = goalFormSchema.safeParse({
    template: form.get("template"),
    name: form.get("name"),
    targetDate: form.get("targetDate"),
    priority: form.get("priority"),
    flexibilityYears: form.get("flexibilityYears") ?? 0,
    memberId: form.get("memberId") ?? "",
  });
  if (!base.success) return { error: fieldError(base.error.issues[0]) } as const;
  const payload = GOAL_PAYLOAD_SCHEMA.safeParse({
    targetToday: form.get("targetToday"),
    inflationPct: form.get("inflationPct"),
    assignedAmount: form.get("assignedAmount") || 0,
    monthlySip: form.get("monthlySip") || 0,
  });
  if (!payload.success) return { error: fieldError(payload.error.issues[0]) } as const;
  const today = new Date().toISOString().slice(0, 10);
  if (base.data.targetDate <= today) return { error: "dateInvalid" } as const;
  let memberId: string | null = null;
  if (base.data.memberId) {
    const members = await listMembers(householdId);
    if (!members.some((m) => m.id === base.data.memberId)) return { error: "generic" } as const;
    memberId = base.data.memberId;
  }
  return { input: { ...base.data, memberId, payload: payload.data } } as const;
}

export async function createGoalAction(_prev: GoalActionState, form: FormData): Promise<GoalActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) return { error: "signedOut" };
  const household = await getCurrentHousehold(user.id);
  const parsed = await parseGoalForm(household.id, form);
  if ("error" in parsed) return { error: parsed.error };
  const goal = await createGoal(household.id, user.id, parsed.input);
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/goals/${goal.id}`);
}

export async function updateGoalAction(_prev: GoalActionState, form: FormData): Promise<GoalActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) return { error: "signedOut" };
  const household = await getCurrentHousehold(user.id);
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { error: "generic" };
  const parsed = await parseGoalForm(household.id, form);
  if ("error" in parsed) return { error: parsed.error };
  const updated = await updateGoal(household.id, user.id, id.data, parsed.input);
  if (!updated) return { error: "generic" };
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/goals/${id.data}?saved=1`);
}

export async function archiveGoalAction(form: FormData): Promise<void> {
  const locale = localeSchema.parse(form.get("locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/app/sign-in`);
  const household = await getCurrentHousehold(user.id);
  const id = idSchema.safeParse(form.get("id"));
  if (id.success && (await getGoal(household.id, id.data))) await archiveGoal(household.id, user.id, id.data);
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/goals`);
}
