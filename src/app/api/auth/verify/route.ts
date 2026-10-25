import { routing } from "@/i18n/routing";
import { audit, consumeEmailToken, emailVerifiedByToken, markEmailVerified } from "@/lib/auth/users";
import { execute } from "@/lib/db";
import { seeOther } from "@/lib/redirect";

/**
 * Email link target for account verification and deletion confirmation. The
 * token is single-use; the result lands on a localised page in the member app.
 * Mail scanners (Outlook Safe Links among them) open links before the reader
 * does, so a verify link whose token is already spent still reports
 * "verified" while it is unexpired and the account is verified.
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
    } else if (!userId && purpose === "verify" && token && (await emailVerifiedByToken(token))) {
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
  return seeOther(dest);
}
