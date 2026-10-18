import { NextResponse } from "next/server";
import { confirm } from "@/lib/newsletter";
import { getStore } from "@/lib/newsletter/store";

/** Confirmation link target: flips the subscriber on, then lands on a localised status page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const store = await getStore();
  const result = store ? await confirm(store, token).catch(() => ({ outcome: "invalid" as const, locale: "en" })) : { outcome: "invalid" as const, locale: "en" };
  return NextResponse.redirect(new URL(`/${result.locale}/newsletter?status=${result.outcome}`, url.origin), 303);
}
