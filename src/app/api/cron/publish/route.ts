import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { routing } from "@/i18n/routing";
import { safeEqual } from "@/lib/db/crypto";
import { databaseConfigured } from "@/lib/db";
import { loadFromDb } from "@/lib/content/db";
import { dueBetween } from "@/lib/content/schedule";
import { CONTENT_TAG } from "@/lib/content/store";

/**
 * Brings scheduled articles and chapters in on time. Call it every 15 minutes
 * (or hourly) from the host's cron with `Authorization: Bearer $CRON_SECRET`.
 * When a scheduled language fell due in the last 75 minutes it expires the
 * content cache and requests the pages once, so the first reader gets the
 * new version. Without it they still appear within the cache's five minutes.
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

  const now = new Date();
  const due = dueBetween(await loadFromDb(), new Date(now.getTime() - 75 * 60_000), now);
  if (due.length > 0) {
    revalidateTag(CONTENT_TAG, { expire: 0 });
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in").replace(/\/$/, "");
    const locales = routing.locales as readonly string[];
    const paths = [...new Set([...locales.flatMap((l) => [`/${l}`, `/${l}/articles`, `/${l}/learn`]), ...due.map((d) => `/${d.locale}${d.path}`)])];
    for (const p of paths) await fetch(`${site}${p}`, { cache: "no-store" }).catch(() => undefined);
  }
  return NextResponse.json({ due: due.length }, { headers: { "cache-control": "no-store" } });
}
