import { openItems, type PlanItemWithStatus } from "../checkup/progress";

/**
 * Monthly plan reminder (opt-in). Pure helpers: whether a member is due one,
 * and which plan step it names. The sender lives in ./send.ts.
 */
export const REMINDER_INTERVAL_DAYS = 28;

export function reminderDue(lastSentAt: Date | null, now = new Date()): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= REMINDER_INTERVAL_DAYS * 24 * 3600 * 1000;
}

/** The first open step in plan order, and the approximate score if it were done. */
export function pickReminder(overall: number, items: PlanItemWithStatus[], today?: string): { item: PlanItemWithStatus; projected: number } | null {
  const item = openItems(items, today)[0];
  if (!item) return null;
  return { item, projected: Math.min(100, overall + Math.max(0, item.scoreImpact)) };
}
