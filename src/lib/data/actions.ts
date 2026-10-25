"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { requireHousehold } from "../auth/current";
import { audit, updateUser } from "../auth/users";
import { parseFirstLook, parseItem, parseMember, parseProfileStep, parseQuickStart, profileStepSchemas, type FieldErrors, type ProfileStep } from "./forms";
import { withStepDone } from "./profileSteps";
import { syncDependants } from "./members";
import { isFamily, type Family } from "./model";
import { archiveItem, archiveMember, createItem, createMember, getItem, listItems, listMembers, updateItem, updateMember } from "./store";

/**
 * Data-capture Server Actions (sections 7 and 8). Each one re-reads the
 * session through requireHousehold and scopes every query by that household.
 * Validation lives in forms.ts; field errors come back as message keys for
 * the form to render under each field.
 */
export type DataActionState = { error?: string; fieldErrors?: FieldErrors; ok?: boolean };

const localeSchema = z.enum(routing.locales as unknown as [string, ...string[]]).catch("en");
const idSchema = z.string().regex(/^[0-9a-f-]{36}$/i);

function familyOf(form: FormData): Family {
  const f = String(form.get("family") ?? "");
  if (!isFamily(f)) throw new Error("Unknown family");
  return f;
}

const BUSINESS_LIKE = new Set(["business", "selfEmployed"]);

export async function quickStart(_prev: DataActionState, form: FormData): Promise<DataActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  // The quick start seeds one income and one expenses item; re-running it (edit mode) only updates the profile.
  const existing = await listItems(household.id);
  const hasIncome = existing.some((i) => i.family === "income");
  const hasExpenses = existing.some((i) => i.family === "expenses");
  const parsed = parseQuickStart(form, { requireAmounts: !hasIncome || !hasExpenses });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const d = parsed.data;

  await updateUser(user.id, {
    dob: d.dob, gender: d.gender ?? null, marital_status: d.maritalStatus, dependants: d.dependants, city: d.city, state: d.state,
    pin: d.pin ?? null, city_tier: d.cityTier, employment: d.employment,
  });
  await audit(user.id, "quickStart", "user", user.id);

  const self = (await listMembers(household.id)).find((m) => m.relation === "self");
  if (!hasIncome && d.monthlyIncome !== undefined) {
    const type = d.employment === "retired" ? "pension" : BUSINESS_LIKE.has(d.employment) ? "business" : "salary";
    await createItem(household.id, user.id, { family: "income", type, memberId: self?.id ?? null, payload: { netMonthly: d.monthlyIncome } });
  }
  if (!hasExpenses && d.monthlyExpenses !== undefined) {
    await createItem(household.id, user.id, { family: "expenses", type: "other", payload: { label: "Monthly expenses", monthly: d.monthlyExpenses } });
  }
  redirect(hasIncome ? `/${locale}/app/data` : `/${locale}/app/welcome?look=1`);
}

const COVER_FLAG = { yes: 1, no: 0, notSure: null } as const;

/**
 * The short first run: income and expenses (required), emergency savings if
 * known, and yes / no / not sure on term and health cover. The rest of the
 * profile is asked afterwards, one question at a time.
 */
export async function firstLook(_prev: DataActionState, form: FormData): Promise<DataActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  const parsed = parseFirstLook(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const existing = await listItems(household.id);
  const self = (await listMembers(household.id)).find((m) => m.relation === "self");

  await updateUser(user.id, { has_term_cover: COVER_FLAG[d.termCover], has_health_cover: COVER_FLAG[d.healthCover] });
  await audit(user.id, "quickStart", "user", user.id);
  // Seed each family once, so going back and submitting again does not double count.
  if (!existing.some((i) => i.family === "income")) {
    const type = user.employment === "retired" ? "pension" : BUSINESS_LIKE.has(user.employment) ? "business" : "salary";
    await createItem(household.id, user.id, { family: "income", type, memberId: self?.id ?? null, payload: { netMonthly: d.monthlyIncome } });
  }
  if (!existing.some((i) => i.family === "expenses")) {
    await createItem(household.id, user.id, { family: "expenses", type: "other", payload: { label: "Monthly expenses", monthly: d.monthlyExpenses } });
  }
  if (d.emergencySavings !== undefined && !existing.some((i) => i.family === "assets")) {
    await createItem(household.id, user.id, { family: "assets", type: "cash", memberId: self?.id ?? null, payload: { label: "Emergency savings", currentValue: d.emergencySavings, liquidity: "liquid" } });
  }
  redirect(`/${locale}/app/welcome?look=1`);
}

/** Answers or skips one profile question: the `skip` field, or saving with the answer left blank, both skip. */
export async function answerProfileStep(_prev: DataActionState, form: FormData): Promise<DataActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user } = await requireHousehold(locale);
  const step = String(form.get("step") ?? "");
  if (!(step in profileStepSchemas)) return { error: "generic" };
  const key = step as ProfileStep;
  const steps = withStepDone(user.profileSteps, key);
  const answer = form.get(key);
  if (form.get("skip") || answer === null || String(answer).trim() === "") {
    await updateUser(user.id, { profile_steps: steps });
  } else {
    const parsed = parseProfileStep(key, form);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
    const d = parsed.data as Record<string, string | number>;
    const column = { dob: "dob", employment: "employment", dependants: "dependants", cityTier: "city_tier" } as const;
    await updateUser(user.id, { [column[key]]: d[key], profile_steps: steps });
  }
  refresh(); // the card lives on the page we are on; make the router refetch it
  return { ok: true };
}

export async function saveMember(_prev: DataActionState, form: FormData): Promise<DataActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  const parsed = parseMember(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const id = idSchema.safeParse(form.get("id"));
  const m = { ...parsed.data, dob: parsed.data.dob ?? null };
  if (id.success) {
    const current = (await listMembers(household.id)).find((x) => x.id === id.data);
    if (!current) return { error: "notFound" };
    if (current.relation === "self") return { error: "selfLocked" };
    await updateMember(household.id, user.id, id.data, m);
  } else {
    await createMember(household.id, user.id, m);
  }
  await syncDependants(household.id, user.id);
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/data/members`);
}

export async function archiveMemberAction(form: FormData): Promise<void> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  const id = idSchema.safeParse(form.get("id"));
  if (id.success) {
    await archiveMember(household.id, user.id, id.data); // the store refuses the self row
    await syncDependants(household.id, user.id);
  }
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/data/members`);
}

export async function saveItem(_prev: DataActionState, form: FormData): Promise<DataActionState> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  const family = familyOf(form);
  const members = await listMembers(household.id);
  const parsed = parseItem(family, form, members.map((m) => m.id));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const id = idSchema.safeParse(form.get("id"));
  if (id.success) {
    const existing = await getItem(household.id, id.data);
    if (!existing || existing.family !== family) return { error: "notFound" };
    await updateItem(household.id, user.id, id.data, parsed.data);
  } else {
    await createItem(household.id, user.id, { family, ...parsed.data });
  }
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/data/${family}`);
}

export async function archiveItemAction(form: FormData): Promise<void> {
  const locale = localeSchema.parse(form.get("locale"));
  const { user, household } = await requireHousehold(locale);
  const family = familyOf(form);
  const id = idSchema.safeParse(form.get("id"));
  if (id.success) {
    const existing = await getItem(household.id, id.data);
    if (existing && existing.family === family) await archiveItem(household.id, user.id, id.data);
  }
  refresh(); // the destination may be the page we are on; make the router refetch it
  redirect(`/${locale}/app/data/${family}`);
}
