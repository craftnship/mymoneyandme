import { NextResponse } from "next/server";
import { z } from "zod";
import { makeRateLimiter, subscribe } from "@/lib/newsletter";
import { getStore } from "@/lib/newsletter/store";
import { getMailer } from "@/lib/newsletter/mail";
import { routing } from "@/i18n/routing";

const schema = z.object({ email: z.string().max(254), locale: z.string().max(8).optional() });
const allow = makeRateLimiter(5, 10 * 60 * 1000);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allow(ip)) return NextResponse.json({ outcome: "rateLimited" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ outcome: "invalid" }, { status: 400 });
  const [store, mailer] = await Promise.all([getStore(), getMailer()]);
  if (!store || !mailer) return NextResponse.json({ outcome: "notConfigured" }, { status: 503 });
  const locale = (routing.locales as readonly string[]).includes(parsed.data.locale ?? "") ? parsed.data.locale! : routing.defaultLocale;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  try {
    const result = await subscribe(store, mailer, parsed.data.email, locale, siteUrl);
    return NextResponse.json(result, { status: result.outcome === "invalid" ? 400 : 200 });
  } catch (e) {
    console.error("newsletter subscribe failed", e);
    return NextResponse.json({ outcome: "error" }, { status: 500 });
  }
}
