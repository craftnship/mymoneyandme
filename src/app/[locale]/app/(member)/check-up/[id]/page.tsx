import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { getCheckUp, previousCheckUp } from "@/lib/checkup/store";
import { diffCheckUps } from "@/lib/checkup/progress";
import { CheckUpReport, WhatChanged } from "@/components/app/checkup/CheckUpReport";
import { formatDate } from "@/components/app/checkup/ui";


export async function generateMetadata() {
  const t = await getTranslations("appCheckup.checkup");
  return { title: t("runTitle") };
}

async function Run({ locale, id }: { locale: string; id: string }) {
  const { household } = await requireHousehold(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const checkup = await getCheckUp(household.id, id);
  if (!checkup) notFound();
  const t = await getTranslations("appCheckup.checkup");
  const previous = await previousCheckUp(household.id, checkup.id);
  return (
    <div className="space-y-8">
      <p className="text-sm text-fg-muted">
        {t("runFrom", { date: formatDate(checkup.createdAt) })} · <Link href="/app/check-up" className="underline underline-offset-4">{t("backToLatest")}</Link>
      </p>
      <CheckUpReport checkup={checkup} />
      {previous ? <WhatChanged diff={diffCheckUps(previous.result, checkup.result)} previousDate={previous.createdAt} /> : <p className="text-sm text-fg-muted">{t("noPrevious")}</p>}
    </div>
  );
}

export default async function CheckUpRunPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations("appCheckup.checkup");
  return (
    <>
      <PageTitle title={t("runTitle")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <Run locale={locale} id={id} />
      </Suspense>
    </>
  );
}
