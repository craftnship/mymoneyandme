import { NextResponse } from "next/server";
import { z } from "zod";
import { isPublicEvent, recordEvent } from "@/lib/events/store";
import { makeRateLimiter } from "@/lib/rateLimit";

const schema = z.object({ name: z.string().max(40), detail: z.string().max(80).optional(), locale: z.string().max(8).optional() });
const allow = makeRateLimiter(60, 60 * 1000);

/** Beacon target for anonymous usage events (calculator runs). Always answers 204 so a blocked or failed beacon changes nothing for the visitor. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allow(ip)) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isPublicEvent(parsed.data.name)) return new NextResponse(null, { status: 204 });
  await recordEvent(parsed.data.name, parsed.data.detail, parsed.data.locale);
  return new NextResponse(null, { status: 204 });
}
