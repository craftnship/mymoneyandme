import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { planForHousehold } from "@/lib/checkup/planStore";
import { isoDateFromNow, planProgress, projectedScore, type PlanItemWithStatus } from "@/lib/checkup/progress";
import { chapterHref } from "@/lib/checkup/chapters";
import { explainItem } from "@/lib/checkup/explain";
import { encodeInputs } from "@/lib/calculators";
import { RunCheckUp } from "@/components/app/checkup/RunCheckUp";
import { PlanItemControls } from "@/components/app/checkup/PlanItemControls";
import { formatEffort, ScoreGauge } from "@/components/app/checkup/ui";

export async function generateMetadata() {
  const t = await getTranslations("appCheckup.plan");
  return { title: t("title") };
}

const BANDS = [1, 2, 3, 4, 5, 6, 7] as const;

function fmtParams(p: Record<string, number | string>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === "number" && v >= 1000 ? new Intl.NumberFormat("en-IN").format(v) : v;
  return out;
}

async function Checklist({ locale }: { locale: string }) {
  const { household } = await requireHousehold(locale);
  const t = await getTranslations("appCheckup.plan");
  const tc = await getTranslations("checkup");
  const tcalc = await getTranslations("calc");
  const plan = await planForHousehold(household.id);

  if (!plan) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">{t("noPlanTitle")}</h2>
        <p className="mt-2 text-fg-muted">{t("noPlanBody")}</p>
        <div className="mt-4"><RunCheckUp first /></div>
      </Card>
    );
  }

  const progress = planProgress(plan.items);
  const projection = projectedScore(plan.checkup.result.overall, plan.items, 3);
  const byBand = new Map<number, PlanItemWithStatus[]>();
  for (const item of plan.items) byBand.set(item.priority, [...(byBand.get(item.priority) ?? []), item]);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = isoDateFromNow();

  return (
    <div className="space-y-8">
      <Card className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
        <ScoreGauge score={progress.pct} label={t("progressLabel", { pct: progress.pct })} />
        <div>
          <p className="text-lg font-semibold">{t("progress", { done: progress.done, total: progress.total })}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("basedOn", { score: plan.checkup.result.overall })} · <Link href="/app/check-up" className="underline underline-offset-4">{t("viewCheckUp")}</Link></p>
          {projection.items.length ? (
            <p className="mt-2 text-sm">{t("projected", { score: projection.score, count: projection.items.length })} <span className="text-fg-muted">({t("approximate")})</span></p>
          ) : null}
        </div>
      </Card>

      <Notice tone="info">{t("disclaimer")}</Notice>

      {BANDS.filter((band) => byBand.get(band)?.length).map((band, index) => {
        const items = byBand.get(band)!;
        return (
          <section key={band} aria-labelledby={`band-${band}`}>
            <h2 id={`band-${band}`} className="text-lg font-semibold mb-3"><span className="font-mono text-fg-muted me-2">{index + 1}</span>{t(`band.${band}`)}</h2>
            <ol className="space-y-3">
              {items.map((item) => {
                const stale = item.status === "snoozed" && item.snoozedUntil && item.snoozedUntil <= today;
                const muted = item.status === "done" || item.status === "skipped" || (item.status === "snoozed" && !stale);
                const explained = explainItem(item, plan.checkup.snapshot, plan.checkup.result.rulePackVersion);
                const calcHref = item.relatedCalculator ? `/calculators/${item.relatedCalculator}${explained ? `?${encodeInputs(explained.calculatorInputs)}` : ""}` : null;
                return (
                  <li key={item.id} id={`item-${item.id}`} className={`rounded-xl border border-border bg-bg-elevated p-4 ${muted ? "opacity-70" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-medium">{t(`titles.${item.template}`)}</h3>
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${item.status === "done" ? "bg-accent-soft text-accent-strong" : item.status === "skipped" ? "bg-bg border border-border text-fg-muted" : item.status === "inProgress" ? "bg-warn-soft text-warn" : "bg-bg border border-border text-fg-muted"}`}>{t(`status.${item.status}`)}</span>
                    </div>
                    <p className="mt-1 text-sm">{tc(`items.${item.template}` as "items.annualReview", fmtParams(item.params))}</p>
                    {explained ? <p className="mt-1 text-xs text-fg-muted">{t(`assumes.${explained.template}`, fmtParams(explained.params))}</p> : null}
                    <ol className="mt-2 list-decimal ps-5 text-sm text-fg-muted space-y-0.5">
                      {([1, 2, 3] as const).map((n) => <li key={n}>{t(`how.${item.template}.${n}`)}</li>)}
                    </ol>
                    <p className="mt-2 text-xs text-fg-muted">
                      {formatEffort(item.effortMinutes, t)}
                      {item.scoreImpact > 0 ? ` · ${tc("impact", { points: item.scoreImpact })}` : ""}
                      {item.relatedCalculator && calcHref ? <> · <Link href={calcHref} className="underline underline-offset-4">{explained ? t("calculatorWithMyNumbers", { name: tcalc(`names.${item.relatedCalculator}` as "names.sip") }) : tcalc(`names.${item.relatedCalculator}` as "names.sip")}</Link></> : null}
                      {item.relatedChapter ? <> · <Link href={chapterHref(item.relatedChapter)} className="underline underline-offset-4">{t("readChapter")}</Link></> : null}
                      {item.template === "fillGaps" ? <> · <Link href="/app/data" className="underline underline-offset-4">{t("addData")}</Link></> : null}
                    </p>
                    {item.status === "skipped" && item.skipReason ? <p className="mt-1 text-xs text-fg-muted">{t("skippedBecause", { reason: item.skipReason })}</p> : null}
                    {item.status === "snoozed" && item.snoozedUntil ? <p className="mt-1 text-xs text-fg-muted">{stale ? t("snoozeOver") : t("snoozedUntil", { date: item.snoozedUntil })}</p> : null}
                    <PlanItemControls itemId={item.id} status={item.status} skipReason={item.skipReason} snoozedUntil={item.snoozedUntil} minDate={tomorrow} />
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appCheckup.plan");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <Checklist locale={locale} />
      </Suspense>
    </>
  );
}
