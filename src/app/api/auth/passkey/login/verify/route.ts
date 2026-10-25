import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { clearLoginFailures, findUserById } from "@/lib/auth/users";
import { finishAuthentication } from "@/lib/auth/webauthn";
import { makeRateLimiter } from "@/lib/rateLimit";

const limiter = makeRateLimiter(20, 15 * 60 * 1000);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!limiter(`passkey:${ip}`)) return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  try {
    const body = await req.json();
    const userId = await finishAuthentication(String(body.challengeId ?? ""), body.response);
    const user = await findUserById(userId);
    if (!user) throw new Error("unknownUser");
    await clearLoginFailures(userId);
    await createSession(userId, "passkey");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
