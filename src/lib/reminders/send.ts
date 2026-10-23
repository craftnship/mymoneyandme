import "server-only";
import { query, execute, type Row } from "../db";
import { householdForUser } from "../auth/users";
import { planForHousehold } from "../checkup/planStore";
import { emailLayout, mailConfigured, sendMail } from "../mail";
import { pickReminder, REMINDER_INTERVAL_DAYS } from "./pick";
import checkupEn from "../../../messages/app-checkup.en.json";
import checkupTa from "../../../messages/app-checkup.ta.json";

/**
 * Sends the monthly plan reminder to members who opted in (consent kind
 * planReminders), have a verified email and have not had one for
 * REMINDER_INTERVAL_DAYS. The email names the next open plan step and the
 * score it could lead to; it carries no amounts. Off unless
 * REMINDERS_ENABLED=true, so a deploy never starts emailing by itself.
 */
export function remindersEnabled() {
  return process.env.REMINDERS_ENABLED === "true" && mailConfigured();
}

type Copy = { subject: string; hello: string; next: string; impact: string; button: string; footer: string };

const COPY: Record<string, Copy> = {
  en: {
    subject: "Your next money step: {title}",
    hello: "Hello {name}.",
    next: "The next open step in your plan is “{title}”.",
    impact: "Finishing it could lift your score from {from} to about {to}.",
    button: "Open my plan",
    footer: "You get this once a month because you turned on plan reminders. Turn them off any time under Settings, Privacy.",
  },
  ta: {
    subject: "உங்கள் அடுத்த பணப் படி: {title}",
    hello: "வணக்கம் {name}.",
    next: "உங்கள் திட்டத்தில் திறந்திருக்கும் அடுத்த படி “{title}”.",
    impact: "அதை முடித்தால் உங்கள் மதிப்பெண் {from} இலிருந்து சுமார் {to} ஆக உயரலாம்.",
    button: "என் திட்டத்தைத் திற",
    footer: "நீங்கள் திட்ட நினைவூட்டல்களை இயக்கியதால் இது மாதம் ஒருமுறை வருகிறது. அமைப்புகள், தனியுரிமையில் எப்போது வேண்டுமானாலும் நிறுத்தலாம்.",
  },
};

const TITLES: Record<string, Record<string, string>> = { en: checkupEn.appCheckup.plan.titles, ta: checkupTa.appCheckup.plan.titles };

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reminderEmail(locale: string, name: string, template: string, from: number, to: number, url: string) {
  const c = COPY[locale] ?? COPY.en;
  const title = TITLES[locale]?.[template] ?? TITLES.en[template] ?? template;
  const lines = [fill(c.hello, { name }), fill(c.next, { title }), to > from ? fill(c.impact, { from, to }) : ""].filter(Boolean);
  return {
    subject: fill(c.subject, { title }),
    text: `${lines.join(" ")}\n\n${c.button}: ${url}\n\n${c.footer}`,
    html: emailLayout(locale, escapeHtml(lines.join(" ")), { label: c.button, url }, escapeHtml(c.footer)),
  };
}

type DueRow = Row & { id: string; email: string; name: string; preferred_name: string | null; locale: string };

export async function sendDueReminders(now = new Date(), limit = 200): Promise<{ sent: number; nothingOpen: number; failed: number }> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in").replace(/\/$/, "");
  const due = await query<DueRow>(
    `SELECT u.id, u.email, u.name, u.preferred_name, u.locale FROM users u
     WHERE u.email_verified_at IS NOT NULL AND u.deletion_requested_at IS NULL
       AND (u.last_reminder_at IS NULL OR u.last_reminder_at <= ?)
       AND (SELECT c.granted FROM consents c WHERE c.user_id = u.id AND c.kind = 'planReminders' ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1) = 1
     LIMIT ?`,
    [new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 3600 * 1000), limit],
  );
  const counts = { sent: 0, nothingOpen: 0, failed: 0 };
  for (const u of due) {
    const household = await householdForUser(u.id);
    const plan = household ? await planForHousehold(household.id) : undefined;
    const pick = plan ? pickReminder(plan.checkup.result.overall, plan.items, now.toISOString().slice(0, 10)) : null;
    if (!plan || !pick) {
      // Marked as handled too, so members with nothing to do cannot crowd out the batch limit day after day.
      await execute("UPDATE users SET last_reminder_at = ? WHERE id = ?", [now, u.id]);
      counts.nothingOpen += 1;
      continue;
    }
    const locale = COPY[u.locale] ? u.locale : "en";
    const mail = reminderEmail(locale, u.preferred_name ?? u.name, pick.item.template, plan.checkup.result.overall, pick.projected, `${site}/${locale}/app/plan#item-${pick.item.id}`);
    try {
      await sendMail({ to: u.email, ...mail });
      await execute("UPDATE users SET last_reminder_at = ? WHERE id = ?", [now, u.id]);
      counts.sent += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}
