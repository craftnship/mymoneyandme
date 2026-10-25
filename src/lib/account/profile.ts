import { z } from "zod";

/**
 * Profile vocabulary and validation shared by the settings forms (client) and
 * the account Server Actions (server). Keep this file free of server-only
 * imports. Option values are stable keys; their labels live in messages.
 */
export const GENDERS = ["female", "male", "nonBinary", "preferNot"] as const;
export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "preferNot"] as const;
export const EMPLOYMENT_TYPES = ["salaried", "selfEmployed", "business", "retired", "student", "homemaker"] as const;
export const NUMBER_FORMATS = ["indian", "international"] as const;
export const CITY_TIERS = ["1", "2", "3"] as const;
export const DISPLAY_LOCALES = ["en", "ta"] as const;
export const RISK_PROFILES = ["conservative", "balanced", "growth"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

/** States and union territories as stable keys; display names come from messages (`appSettings.states`). */
export const INDIAN_STATES = [
  "AN", "AP", "AR", "AS", "BR", "CH", "CT", "DH", "DL", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OR", "PY", "PB", "RJ", "SK", "TN", "TG", "TR", "UP", "UT", "WB",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).transform((s) => s || null);
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).or(z.literal("")).transform((s) => s || null);

function isoDateValid(s: string) {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function ageOn(dob: string, today = new Date()): number {
  const d = new Date(`${dob}T00:00:00Z`);
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

/** Field names double as error keys (`appSettings.errors.<field>`), so a failed check names the field. */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "name").max(100, "name"),
  preferredName: optionalText(100),
  dob: z.string().trim().refine((s) => s === "" || (/^\d{4}-\d{2}-\d{2}$/.test(s) && isoDateValid(s) && ageOn(s) >= 18 && ageOn(s) <= 110), "dob").transform((s) => s || null),
  gender: optionalEnum(GENDERS),
  maritalStatus: optionalEnum(MARITAL_STATUSES),
  city: optionalText(100),
  state: optionalEnum(INDIAN_STATES),
  pin: z.string().trim().refine((s) => s === "" || /^[1-9]\d{5}$/.test(s), "pin").transform((s) => s || null),
  cityTier: z.enum(CITY_TIERS),
  locale: z.enum(DISPLAY_LOCALES),
  numberFormat: z.enum(NUMBER_FORMATS),
  employment: z.enum(EMPLOYMENT_TYPES),
  retirementAge: z.string().trim().refine((s) => s === "" || /^\d{2}$/.test(s), "retirementAge").transform((s) => (s ? Number(s) : null)).refine((n) => n === null || (n >= 40 && n <= 80), "retirementAge"),
  smoker: z.enum(["", "yes", "no"]).transform((s) => (s === "" ? null : s === "yes")),
  existingConditions: z.enum(["", "yes", "no"]).transform((s) => (s === "" ? null : s === "yes")),
  hasWill: z.enum(["", "yes", "no"]).transform((s) => (s === "" ? null : s === "yes")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Risk-tolerance questionnaire: five questions, three answers each scored
 * 1 (cautious) to 3 (adventurous). Totals 5-15 map to the three profiles the
 * check-up and plan use. Question and answer text lives in messages under
 * `appSettings.risk.q.<id>`.
 */
export const RISK_QUESTIONS = ["horizon", "drop", "experience", "income", "priority"] as const;
export type RiskQuestion = (typeof RISK_QUESTIONS)[number];
export const RISK_ANSWERS = ["1", "2", "3"] as const;

const answer = z.enum(RISK_ANSWERS);
export const riskSchema = z.object({ horizon: answer, drop: answer, experience: answer, income: answer, priority: answer });
export type RiskAnswers = z.infer<typeof riskSchema>;

export function scoreRisk(answers: RiskAnswers): RiskProfile {
  const total = RISK_QUESTIONS.reduce((sum, q) => sum + Number(answers[q]), 0);
  if (total <= 7) return "conservative";
  if (total <= 11) return "balanced";
  return "growth";
}

export function isRiskProfile(s: string | null | undefined): s is RiskProfile {
  return (RISK_PROFILES as readonly string[]).includes(s ?? "");
}
