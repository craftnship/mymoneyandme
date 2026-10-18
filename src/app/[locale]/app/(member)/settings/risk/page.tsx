import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice } from "@/components/ui";
import { RiskForm } from "@/components/app/settings/RiskForm";
import { requireUser } from "@/lib/auth/current";
import { isRiskProfile } from "@/lib/account/profile";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("appSettings");
  return { title: `${t("risk.title")} · ${t("title")}`, robots: { index: false } };
}

async function Current({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const user = await requireUser(locale);
  const result = (await searchParams).result;
  const t = await getTranslations("appSettings.risk");
  const to = await getTranslations("appSettings.options.risk");
  const justSet = typeof result === "string" && isRiskProfile(result) && result === user.riskProfile;
  return (
    <div className="mb-6 space-y-3">
      {justSet ? (
        <Notice tone="tip">
          <span role="status">{t("result", { profile: to(result) })} {t(`explain.${result}`)}</span>{" "}
          <Link href="/app/settings" className="underline underline-offset-4">{t("backToProfile")}</Link>
        </Notice>
      ) : isRiskProfile(user.riskProfile) ? (
        <Notice tone="info">{t("current", { profile: to(user.riskProfile) })} {t(`explain.${user.riskProfile}`)}</Notice>
      ) : null}
    </div>
  );
}

export default async function RiskPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("appSettings.risk");
  return (
    <Card>
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <p className="mt-2 mb-6 text-fg-muted">{t("intro")}</p>
      <Suspense fallback={null}><Current locale={locale} searchParams={searchParams} /></Suspense>
      <RiskForm />
    </Card>
  );
}
