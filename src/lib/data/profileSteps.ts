import type { ProfileStep } from "./forms";

/**
 * After the short quick start, the rest of the profile is asked one question
 * at a time, in the order that most improves the check-up. Each can be
 * answered or skipped; either way it is not asked again.
 */
export const PROFILE_STEPS: readonly ProfileStep[] = ["dob", "employment", "dependants", "cityTier"];

type StepUser = { profileSteps: string[]; city: string | null };

/** The next question to ask, or null when every one has been answered or skipped. */
export function nextProfileStep(user: StepUser): ProfileStep | null {
  // Accounts from the long quick start answered all of these at once; it required a city.
  if (user.city) return null;
  const done = new Set(user.profileSteps);
  return PROFILE_STEPS.find((s) => !done.has(s)) ?? null;
}

/** The stored list with `step` added, kept in PROFILE_STEPS order. */
export function withStepDone(steps: string[], step: ProfileStep): string {
  const done = new Set([...steps, step]);
  return PROFILE_STEPS.filter((s) => done.has(s)).join(",");
}

export function profileStepProgress(user: StepUser): { done: number; total: number } {
  const total = PROFILE_STEPS.length;
  if (user.city) return { done: total, total };
  return { done: PROFILE_STEPS.filter((s) => user.profileSteps.includes(s)).length, total };
}
