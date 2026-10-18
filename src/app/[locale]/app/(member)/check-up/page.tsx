import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { latestCheckUp, listCheckUps, previousCheckUp } from "@/lib/checkup/store";
import { diffCheckUps } from "@/lib/checkup/progress";
import { listItems } from "@/lib/data/store";
import { CheckUpReport, WhatChanged } from "@/components/app/checkup/CheckUpReport";
import { RunCheckUp } from "@/components/app/checkup/RunCheckUp";
import { formatDate } from "@/components/app/checkup/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("appCheckup.checkup");
  return { title: t("title") };
}

async function Latest({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const { household } = await requireHousehold(locale);
  const t = await getTranslations("appCheckup.checkup");
  const tc = await getTranslations("checkup");
  const [latest, history, incomes, ran] = await Promise.all([latestCheckUp(household.id), listCheckUps(household.id), listItems(household.id, "income"), searchParams.then((p) => p.ran)]);

  if (!latest) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">{t("noneTitle")}</h2>
        <p className="mt-2 text-fg-muted">{incomes.length ? t("noneBody") : t("noDataBody")}</p>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <RunCheckUp first />
          {!incomes.length ? <Link href="/app/data" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("addData")}</Link> : null}
        </div>
      </Card>
    );
  }

  const previous = await previousCheckUp(household.id, latest.id);
  return (
    <div className="space-y-8">
      {ran === latest.id ? <Notice tone="tip">{t("justRan")}</Notice> : null}
      <div className="flex flex-wrap items-center gap-3">
        <RunCheckUp />
        <Link href="/app/plan" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("viewPlan")}</Link>
      </div>
      <CheckUpReport checkup={latest} />
      {previous ? <WhatChanged diff={diffCheckUps(previous.result, latest.result)} previousDate={previous.createdAt} /> : <p className="text-sm text-fg-muted">{t("noPrevious")}</p>}

      <section aria-labelledby="history">
        <h2 id="history" className="text-xl font-semibold mb-3">{t("history")}</h2>
        <ol className="divide-y divide-border rounded-card border border-border bg-bg-elevated">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="tabular-nums text-fg-muted">{formatDate(h.createdAt)}</span>
              <span className="font-semibold tabular-nums">{h.overall}</span>
              <span>{tc(`grade.${h.grade}` as "grade.good")}</span>
              <span className="text-fg-muted">{tc("confidence", { level: tc(`confidenceLevel.${h.confidence}`) })}</span>
              <Link href={`/app/check-up/${h.id}`} className="ms-auto underline underline-offset-4">{h.id === latest.id ? t("latest") : t("viewRun")}</Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default async function CheckUpPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("appCheckup.checkup");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <Latest locale={locale} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
