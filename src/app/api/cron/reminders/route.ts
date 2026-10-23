import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/db/crypto";
import { databaseConfigured } from "@/lib/db";
import { remindersEnabled, sendDueReminders } from "@/lib/reminders/send";

/**
 * Monthly plan reminders for members who opted in. Call it daily from the
 * host's cron with `Authorization: Bearer $CRON_SECRET`; each member gets at
 * most one every 28 days. It does nothing unless REMINDERS_ENABLED=true and
 * SMTP is configured.
 */
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !databaseConfigured()) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented || !safeEqual(presented, secret)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!remindersEnabled()) return NextResponse.json({ error: "disabled" }, { status: 503 });
  const result = await sendDueReminders();
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
