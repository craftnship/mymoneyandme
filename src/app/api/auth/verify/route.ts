import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { audit, consumeEmailToken, markEmailVerified } from "@/lib/auth/users";
import { execute } from "@/lib/db";

/**
 * Email link target for account verification and deletion confirmation. The
 * token is single-use; the result lands on a localised page in the member app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const purpose = url.searchParams.get("purpose") === "delete" ? "delete" : "verify";
  const raw = url.searchParams.get("locale") ?? "en";
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : "en";
  let status = "invalid";
  try {
    const userId = token ? await consumeEmailToken(token, purpose) : null;
    if (userId && purpose === "verify") {
      await markEmailVerified(userId);
      await audit(userId, "emailVerified", "user", userId);
      status = "verified";
    } else if (userId) {
      await execute("UPDATE users SET deletion_requested_at = NOW() WHERE id = ?", [userId]);
      await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
      await audit(userId, "deletionConfirmed", "user", userId);
      status = "deletionScheduled";
    }
  } catch {
    status = "invalid";
  }
  const dest = purpose === "delete" ? `/${locale}/app/sign-in?status=${status}` : `/${locale}/app?status=${status}`;
  return NextResponse.redirect(new URL(dest, url.origin), 303);
}
