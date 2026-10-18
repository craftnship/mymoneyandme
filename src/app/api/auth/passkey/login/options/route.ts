import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { authenticationOptions } from "@/lib/auth/webauthn";

export async function POST() {
  if (!databaseConfigured()) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  return NextResponse.json(await authenticationOptions());
}
