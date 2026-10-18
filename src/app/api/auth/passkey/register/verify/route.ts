import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { finishRegistration } from "@/lib/auth/webauthn";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  try {
    const body = await req.json();
    const id = await finishRegistration(user.id, String(body.challengeId ?? ""), body.response, typeof body.name === "string" ? body.name : null);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
