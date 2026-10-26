import "server-only";
import { databaseConfigured, execute } from "../db";

/**
 * Anonymous product events for the usage report. Only the names below are
 * accepted and the detail is a short slug, so the table can never hold
 * personal data by accident. Member actions are not recorded here: the
 * audit log already has them with the actor, which the report needs for
 * active-user counts.
 */
export const PUBLIC_EVENTS = ["calculatorUsed", "quickCheckRun", "articleRead", "chapterRead"] as const;
export type PublicEvent = (typeof PUBLIC_EVENTS)[number];

export function isPublicEvent(name: string): name is PublicEvent {
  return (PUBLIC_EVENTS as readonly string[]).includes(name);
}

const DETAIL = /^[a-z0-9][a-z0-9/-]{0,79}$/;

/** Records one event; silently does nothing without a database so public pages never fail on it. */
export async function recordEvent(name: PublicEvent, detail?: string | null, locale?: string | null): Promise<boolean> {
  if (!databaseConfigured()) return false;
  const d = detail && DETAIL.test(detail) ? detail : null;
  try {
    await execute("INSERT INTO events (name, detail, locale) VALUES (?, ?, ?)", [name, d, locale?.slice(0, 8) ?? null]);
    return true;
  } catch (e) {
    console.error("event not recorded", e);
    return false;
  }
}
