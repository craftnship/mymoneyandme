import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MemberShell } from "@/components/app/MemberShell";

/**
 * Member area. The session read happens inside <Suspense> (Cache Components
 * rule) in MemberShell, which redirects to sign-in when nobody is signed in.
 */
export const metadata = { robots: { index: false } };

export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
      <MemberShell locale={locale}>{children}</MemberShell>
    </Suspense>
  );
}
