import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/db/crypto";
import { databaseConfigured } from "@/lib/db";
import { recordSnapshotsForAllHouseholds } from "@/lib/snapshots/store";

/**
 * Month-end money snapshots. Snapshots are rewritten whenever a member saves
 * data, so this only fills in the households that did nothing this month.
 * Call it on the first of each month (daily is fine: a month already written
 * is skipped) with `Authorization: Bearer $CRON_SECRET`.
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
  const counts = await recordSnapshotsForAllHouseholds();
  return NextResponse.json(counts, { headers: { "cache-control": "no-store" } });
}
