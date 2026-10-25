import { z } from "zod";
import { checkboxFields, EMPLOYMENT, FIELD_SPECS, GENDERS, INDIAN_STATES, MARITAL, RELATIONS } from "./fields";
import { CONFIDENCE, ITEM_TYPES, PAYLOAD_SCHEMAS, type Family } from "./model";

/**
 * FormData -> validated input for the data Server Actions. Kept apart from the
 * actions so the validation can be unit-tested without a session. Field errors
 * are message keys under appData.errors, keyed by field name.
 */
export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate").refine((s) => !Number.isNaN(Date.parse(s)), "invalidDate");
const pastDate = dateStr.refine((s) => Date.parse(s) <= Date.now(), "futureDate");

export const quickStartSchema = z.object({
  dob: pastDate,
  gender: z.enum(GENDERS).optional(),
  maritalStatus: z.enum(MARITAL),
  dependants: z.coerce.number().int().min(0).max(20),
  city: z.string().trim().min(1).max(100),
  state: z.enum(INDIAN_STATES),
  pin: z.string().trim().regex(/^[1-9]\d{5}$/, "invalidPin").optional(),
  cityTier: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])),
  employment: z.enum(EMPLOYMENT),
  monthlyIncome: z.coerce.number().min(0).max(1e9).optional(),
  monthlyExpenses: z.coerce.number().min(0).max(1e9).optional(),
});
export type QuickStartInput = z.infer<typeof quickStartSchema>;

/** The short first-run form: the two amounts, savings if known, and yes / no / not sure on cover. */
const coverAnswer = z.enum(["yes", "no", "notSure"]).default("notSure");
export const firstLookSchema = z.object({
  monthlyIncome: z.coerce.number().min(0).max(1e9),
  monthlyExpenses: z.coerce.number().min(0).max(1e9),
  emergencySavings: z.coerce.number().min(0).max(1e12).optional(),
  termCover: coverAnswer,
  healthCover: coverAnswer,
});
export type FirstLookInput = z.infer<typeof firstLookSchema>;

/** Each profile question asked one at a time after the first look. */
export const profileStepSchemas = {
  dob: z.object({ dob: pastDate }),
  employment: z.object({ employment: z.enum(EMPLOYMENT) }),
  dependants: z.object({ dependants: z.coerce.number().int().min(0).max(20) }),
  cityTier: z.object({ cityTier: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])) }),
} as const;
export type ProfileStep = keyof typeof profileStepSchemas;

export const memberSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relation: z.enum(RELATIONS),
  dob: pastDate.optional(),
  earns: z.boolean(),
  dependant: z.boolean(),
});
export type MemberInput = z.infer<typeof memberSchema>;

export type ItemInput = { type: string; memberId: string | null; confidence: (typeof CONFIDENCE)[number]; payload: unknown };

/** Empty strings mean "not given" so optional numbers do not coerce to 0 and required ones fail cleanly. */
function str(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function errorsOf(result: z.ZodSafeParseError<unknown>): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (out[field]) continue;
    out[field] = codeFor(issue);
  }
  return out;
}

const KNOWN_KEYS = new Set(["invalidDate", "futureDate", "invalidPin"]);

function codeFor(issue: z.core.$ZodIssue): string {
  // Messages set in this file are already keys; zod's own codes map to generic ones.
  if (KNOWN_KEYS.has(issue.message)) return issue.message;
  switch (issue.code) {
    case "invalid_type": return issue.input === undefined ? "required" : "invalid";
    case "too_small": return (issue as { origin?: string }).origin === "string" ? "required" : "tooSmall";
    case "too_big": return "tooBig";
    case "invalid_value": return "invalid";
    default: return "invalid";
  }
}

/** The amounts are required on first run; in edit mode (items already exist) only the profile fields are read. */
export function parseQuickStart(form: FormData, opts: { requireAmounts: boolean } = { requireAmounts: true }): Parsed<QuickStartInput> {
  const raw = {
    dob: str(form, "dob"), gender: str(form, "gender"), maritalStatus: str(form, "maritalStatus"), dependants: str(form, "dependants") ?? "0",
    city: str(form, "city"), state: str(form, "state"), pin: str(form, "pin"), cityTier: str(form, "cityTier"), employment: str(form, "employment"),
    monthlyIncome: str(form, "monthlyIncome"), monthlyExpenses: str(form, "monthlyExpenses"),
  };
  const r = quickStartSchema.safeParse(raw);
  const fieldErrors: FieldErrors = r.success ? {} : errorsOf(r);
  if (opts.requireAmounts && raw.monthlyIncome === undefined) fieldErrors.monthlyIncome ??= "required";
  if (opts.requireAmounts && raw.monthlyExpenses === undefined) fieldErrors.monthlyExpenses ??= "required";
  return r.success && !Object.keys(fieldErrors).length ? { ok: true, data: r.data } : { ok: false, fieldErrors };
}

export function parseFirstLook(form: FormData): Parsed<FirstLookInput> {
  const raw = { monthlyIncome: str(form, "monthlyIncome"), monthlyExpenses: str(form, "monthlyExpenses"), emergencySavings: str(form, "emergencySavings"), termCover: str(form, "termCover"), healthCover: str(form, "healthCover") };
  const r = firstLookSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, fieldErrors: errorsOf(r) };
}

export function parseProfileStep<K extends ProfileStep>(step: K, form: FormData): Parsed<z.infer<(typeof profileStepSchemas)[K]>> {
  const raw = { dob: str(form, "dob"), employment: str(form, "employment"), dependants: str(form, "dependants"), cityTier: str(form, "cityTier") };
  const r = profileStepSchemas[step].safeParse(raw);
  return r.success ? { ok: true, data: r.data as z.infer<(typeof profileStepSchemas)[K]> } : { ok: false, fieldErrors: errorsOf(r) };
}

export function parseMember(form: FormData): Parsed<MemberInput> {
  const raw = { name: str(form, "name"), relation: str(form, "relation"), dob: str(form, "dob"), earns: form.get("earns") === "on", dependant: form.get("dependant") === "on" };
  const r = memberSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, fieldErrors: errorsOf(r) };
}

/** Builds the payload object from the family's field spec, then validates it with the family schema. */
export function parseItem(family: Family, form: FormData, members: readonly string[]): Parsed<ItemInput> {
  const fieldErrors: FieldErrors = {};
  const type = str(form, "type") ?? "";
  if (!ITEM_TYPES[family].includes(type)) fieldErrors.type = "invalid";
  const confidenceRaw = str(form, "confidence") ?? "entered";
  if (!(CONFIDENCE as readonly string[]).includes(confidenceRaw)) fieldErrors.confidence = "invalid";
  const memberRaw = str(form, "memberId");
  if (memberRaw && !members.includes(memberRaw)) fieldErrors.memberId = "invalid";

  const payload: Record<string, unknown> = {};
  for (const spec of FIELD_SPECS[family]) {
    if (spec.kind === "checkbox") payload[spec.name] = form.get(spec.name) === "on";
    else if (spec.kind === "memberMulti") payload[spec.name] = form.getAll(spec.name).filter((v): v is string => typeof v === "string" && members.includes(v));
    else {
      const v = str(form, spec.name);
      if (v !== undefined) payload[spec.name] = v;
    }
  }
  for (const name of checkboxFields(family)) if (!(name in payload)) payload[name] = false;

  const r = PAYLOAD_SCHEMAS[family].safeParse(payload);
  if (!r.success) Object.assign(fieldErrors, errorsOf(r));
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, data: { type, memberId: memberRaw ?? null, confidence: confidenceRaw as ItemInput["confidence"], payload: r.success ? r.data : payload } };
}

export function ageFromDob(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
