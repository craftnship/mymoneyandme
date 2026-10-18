import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { registrationOptions } from "@/lib/auth/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  return NextResponse.json(await registrationOptions(user));
}
