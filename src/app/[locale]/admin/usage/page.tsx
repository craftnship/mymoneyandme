import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { usageReport, type UsageReport, type WindowCounts } from "@/lib/events/usage";
import { Card, Notice, PageTitle } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("admin.usage");
  return { title: t("title"), robots: { index: false } };
}

const KEYS: (keyof WindowCounts)[] = ["activePlanners", "signUps", "signedIn", "checkUps", "stepsDone", "goalsCreated", "itemsSaved", "calculatorRuns", "quickChecks"];

function delta(now: number, before: number): string {
  if (before === 0) return now === 0 ? "" : "new";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** Usage counts for the people running the site: no amounts, no names, only what members and visitors did. */
export default async function UsagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("admin.usage");
  return (
    <Suspense fallback={<PageTitle title={t("title")} intro={t("intro")} />}>
      <UsageBody locale={locale} />
    </Suspense>
  );
}

/** The session check and the report read request-time data, so they live under the Suspense boundary. */
async function UsageBody({ locale }: { locale: string }) {
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const t = await getTranslations("admin.usage");
  const tc = await getTranslations("calc");

  if (!databaseConfigured()) {
    return (
      <>
        <PageTitle title={t("title")} intro={t("intro")} />
        <Notice tone="warning">{t("noDatabase")}</Notice>
      </>
    );
  }
  const report: UsageReport = await usageReport();
  const th = "px-3 py-2 text-start font-medium text-fg-muted";
  const td = "px-3 py-2 tabular-nums";

  return (
    <div className="space-y-8">
      <PageTitle title={t("title")} intro={t("intro")} />
      <Notice tone="info">{t("northStar")}</Notice>

      <section aria-labelledby="windows">
        <h2 id="windows" className="mb-3 text-xl font-semibold">{t("last30")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {KEYS.map((k) => (
            <Card key={k} className={k === "activePlanners" ? "border-accent" : ""}>
              <p className="text-sm text-fg-muted">{t(`metric.${k}`)}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{report.last30[k]}</p>
              <p className="text-xs text-fg-muted">{t("previous", { count: report.previous30[k] })}{delta(report.last30[k], report.previous30[k]) ? ` · ${delta(report.last30[k], report.previous30[k])}` : ""}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="months">
        <h2 id="months" className="mb-3 text-xl font-semibold">{t("byMonth")}</h2>
        <div className="overflow-x-auto rounded-card border border-border bg-bg-elevated">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>{t("month")}</th><th className={th}>{t("metric.activePlanners")}</th><th className={th}>{t("metric.signUps")}</th><th className={th}>{t("metric.checkUps")}</th><th className={th}>{t("metric.calculatorRuns")}</th></tr></thead>
            <tbody>
              {report.months.map((m) => (
                <tr key={m.month} className="border-t border-border"><td className="px-3 py-2 font-mono">{m.month}</td><td className={td}>{m.northStar}</td><td className={td}>{m.signUps}</td><td className={td}>{m.checkUps}</td><td className={td}>{m.calculatorRuns}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{t("activation.title")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t("activation.intro")}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3"><dt>{t("activation.signedUp")}</dt><dd className="tabular-nums font-medium">{report.activation.signedUp}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t("activation.ranCheckUp")}</dt><dd className="tabular-nums font-medium">{report.activation.ranCheckUp}{report.activation.signedUp ? ` (${Math.round((report.activation.ranCheckUp / report.activation.signedUp) * 100)}%)` : ""}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t("activation.createdGoal")}</dt><dd className="tabular-nums font-medium">{report.activation.createdGoal}{report.activation.signedUp ? ` (${Math.round((report.activation.createdGoal / report.activation.signedUp) * 100)}%)` : ""}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t("activation.median")}</dt><dd className="tabular-nums font-medium">{report.activation.medianHoursToCheckUp === null ? "—" : t("activation.hours", { count: Math.round(report.activation.medianHoursToCheckUp * 10) / 10 })}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold">{t("topCalculators")}</h2>
          {report.topCalculators.length ? (
            <ol className="mt-3 space-y-1 text-sm">
              {report.topCalculators.map((c) => (
                <li key={c.slug} className="flex justify-between gap-3"><span>{tc.has(`names.${c.slug}`) ? tc(`names.${c.slug}` as "names.sip") : c.slug}</span><span className="tabular-nums font-medium">{c.runs}</span></li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-fg-muted">{t("noCalculators")}</p>}
        </Card>
      </div>
      <p className="text-xs text-fg-muted">{t("generated", { date: report.generatedAt.slice(0, 16).replace("T", " ") })} · {t("privacy")}</p>
    </div>
  );
}
