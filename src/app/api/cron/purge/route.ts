import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/db/crypto";
import { databaseConfigured } from "@/lib/db";
import { purgeDueDeletions } from "@/lib/account/purge";

/**
 * Scheduled erasure of accounts past their 30-day grace period. Call it from
 * the host's cron with `Authorization: Bearer $CRON_SECRET`; it refuses to run
 * when the secret is unset so a misconfigured deploy never purges by accident.
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
  const purged = await purgeDueDeletions();
  return NextResponse.json({ purged }, { headers: { "cache-control": "no-store" } });
}
