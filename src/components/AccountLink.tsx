import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Header link to the member app. Only checks whether a session cookie exists
 * (no database read on public pages); the member pages verify the session.
 * Must render inside <Suspense> because it reads cookies.
 */
export async function AccountLink() {
  const t = await getTranslations("nav");
  const signedIn = Boolean((await cookies()).get(SESSION_COOKIE));
  return (
    <Link href={signedIn ? "/app" : "/app/sign-in"} className="rounded-lg border border-border px-2.5 sm:px-3 py-1.5 text-[0.8125rem] sm:text-sm font-medium whitespace-nowrap hover:bg-accent-soft">
      {signedIn ? t("account") : t("signIn")}
    </Link>
  );
}
