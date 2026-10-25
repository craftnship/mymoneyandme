import { describe, expect, it } from "vitest";
import { pickReminder, reminderDue, REMINDER_INTERVAL_DAYS } from "./pick";
import { reminderEmail } from "./send";
import type { PlanItemWithStatus } from "../checkup/progress";

const NOW = new Date("2026-10-23T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 3600 * 1000);

function item(id: string, status: PlanItemWithStatus["status"], scoreImpact: number, snoozedUntil?: string): PlanItemWithStatus {
  return { id, priority: 3, dimension: "insurance", template: "raiseTermCover", params: {}, effortMinutes: 30, scoreImpact, rule: "", status, snoozedUntil } as PlanItemWithStatus;
}

describe("reminderDue", () => {
  it("is due for a first reminder and again after the interval", () => {
    expect(reminderDue(null, NOW)).toBe(true);
    expect(reminderDue(daysAgo(REMINDER_INTERVAL_DAYS - 1), NOW)).toBe(false);
    expect(reminderDue(daysAgo(REMINDER_INTERVAL_DAYS), NOW)).toBe(true);
  });
});

describe("pickReminder", () => {
  it("names the first open step and caps the projected score at 100", () => {
    const items = [item("a", "done", 10), item("b", "snoozed", 5, "2026-12-01"), item("c", "todo", 8), item("d", "todo", 20)];
    expect(pickReminder(60, items, "2026-10-23")).toMatchObject({ item: { id: "c" }, projected: 68 });
    expect(pickReminder(95, items, "2026-10-23")?.projected).toBe(100);
  });
  it("returns nothing when every step is done, skipped or snoozed", () => {
    expect(pickReminder(60, [item("a", "done", 10), item("b", "skipped", 5), item("c", "snoozed", 5, "2026-12-01")], "2026-10-23")).toBeNull();
  });
});

describe("reminderEmail", () => {
  it("uses the plan step title, escapes the name and carries no amounts", () => {
    const m = reminderEmail("en", "<Ravi>", "raiseTermCover", 60, 68, "https://example.test/en/app/plan#item-c");
    expect(m.subject).toContain("Your next money step:");
    expect(m.html).toContain("&lt;Ravi&gt;");
    expect(m.html).not.toContain("<Ravi>");
    expect(m.text).toContain("from 60 to about 68");
    expect(m.text).not.toMatch(/₹|Rs\.?\s?\d/);
  });
  it("writes Tamil for Tamil members, falls back to English otherwise, and drops the score line when nothing would change", () => {
    expect(reminderEmail("ta", "Ravi", "raiseTermCover", 60, 68, "u").subject).toContain("உங்கள் அடுத்த பணப் படி");
    const fallback = reminderEmail("xx", "Ravi", "raiseTermCover", 60, 60, "u");
    expect(fallback.subject).toContain("Your next money step:");
    expect(fallback.text).not.toContain("about");
  });
});
