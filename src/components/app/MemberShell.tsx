import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current";
import { signOut } from "@/lib/auth/actions";
import { Notice } from "@/components/ui";
import { ResendVerification } from "./ResendVerification";

/** Signed-in frame: sub-navigation, verification nudge, sign-out. Server component; must render inside <Suspense>. */
export async function MemberShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  const user = await requireUser(locale);
  const t = await getTranslations("app.nav");
  const ta = await getTranslations("app.auth");
  const links = [
    { href: "/app", label: t("dashboard") },
    { href: "/app/data", label: t("data") },
    { href: "/app/goals", label: t("goals") },
    { href: "/app/plan", label: t("plan") },
    { href: "/app/settings", label: t("settings") },
  ] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <nav aria-label={t("memberMenu")} className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-lg text-sm font-medium text-fg-muted whitespace-nowrap hover:text-fg hover:bg-accent-soft">{l.label}</Link>
          ))}
        </nav>
        <form action={signOut} className="ms-auto flex items-center gap-3 text-sm">
          <input type="hidden" name="locale" value={locale} />
          <span className="text-fg-muted hidden sm:inline">{user.preferredName ?? user.name}</span>
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent-soft">{ta("signOut")}</button>
        </form>
      </div>
      {!user.emailVerifiedAt ? (
        <Notice tone="info">
          {ta("verifyNudge", { email: user.email })} <ResendVerification />
        </Notice>
      ) : null}
      {user.deletionRequestedAt ? <Notice tone="warning">{ta("deletionPending")}</Notice> : null}
      {children}
    </div>
  );
}
