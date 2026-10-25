import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { adminAccess } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/actions";
import { Notice, Pill } from "@/components/ui";

/**
 * Frame of the authoring console. Server component; must render inside
 * <Suspense>. Members who are not staff get a 404 so the console is not
 * advertised; staff on a password session are asked for a passkey.
 */
export async function AdminShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  const access = await adminAccess(locale);
  const t = await getTranslations("admin");
  const ta = await getTranslations("app.auth");
  if (!access.ok && access.reason === "notStaff") notFound();

  const signOutForm = (
    <form action={signOut} className="flex shrink-0 items-center gap-3 text-sm">
      <input type="hidden" name="locale" value={locale} />
      <span className="text-fg-muted hidden sm:inline">{access.user.preferredName ?? access.user.name}</span>
      <button type="submit" className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent-soft">{ta("signOut")}</button>
    </form>
  );

  if (!access.ok) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">{t("access.needsPasskeyTitle")}</h1>
        <p className="text-fg-muted">{t("access.needsPasskeyBody")}</p>
        <Notice tone="info">
          {t("access.noPasskey")}{" "}
          <Link href="/app/settings/security" className="underline underline-offset-4">{t("access.openSecurity")}</Link>
        </Notice>
        {signOutForm}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <nav aria-label={t("nav.label")} className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <Link href="/admin" className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-fg bg-accent-soft">{t("nav.overview")}</Link>
          <Link href="/app" className="px-3 py-1.5 rounded-lg text-sm font-medium text-fg-muted whitespace-nowrap hover:text-fg hover:bg-accent-soft">{t("nav.backToSite")}</Link>
        </nav>
        <Pill tone="accent">{t(`role.${access.role}`)}</Pill>
        {signOutForm}
      </div>
      {children}
    </div>
  );
}
