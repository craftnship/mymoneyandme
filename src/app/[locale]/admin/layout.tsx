import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Authoring console. As in the member area, the session read happens inside
 * <Suspense> (Cache Components rule); AdminShell redirects to sign-in, hides
 * the console from members and asks staff for a passkey session.
 */
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
      <AdminShell locale={locale}>{children}</AdminShell>
    </Suspense>
  );
}
