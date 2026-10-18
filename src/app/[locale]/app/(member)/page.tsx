import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listItems } from "@/lib/data/store";
import { planForHousehold } from "@/lib/checkup/planStore";
import { openItems, planProgress } from "@/lib/checkup/progress";
import { listGoals } from "@/lib/goals/store";
import { projectGoal } from "@/lib/goals/math";
import { RunCheckUp } from "@/components/app/checkup/RunCheckUp";
import { formatDate, ProgressBar, ScoreGauge, statusClass } from "@/components/app/checkup/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Status({ searchParams }: { searchParams: SearchParams }) {
  const status = (await searchParams).status;
  const t = await getTranslations("app.auth");
  if (status === "verified") return <div className="mb-6"><Notice tone="tip">{t("verified")}</Notice></div>;
  if (status === "invalid") return <div className="mb-6"><Notice tone="warning">{t("linkInvalid")}</Notice></div>;
  return null;
}

async function Overview({ locale }: { locale: string }) {
  const { user, household } = await requireHousehold(locale);
  const t = await getTranslations("appCheckup.dashboard");
  const tc = await getTranslations("checkup");
  const td = await getTranslations("app.dashboard");
  const tp = await getTranslations("appCheckup.plan");
  const [plan, goals, incomes] = await Promise.all([planForHousehold(household.id), listGoals(household.id), listItems(household.id, "income")]);
  const now = new Date();
  const projected = goals.map((g) => projectGoal({ ...g.payload, targetDate: g.targetDate }, now));
  const onTrack = projected.filter((p) => p.onTrack).length;
  const next = plan ? openItems(plan.items).slice(0, 3) : [];
  const progress = plan ? planProgress(plan.items) : null;
  const result = plan?.checkup.result;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold">{td("hello", { name: user.preferredName ?? user.name })}</h2>
        {!incomes.length ? (
          <p className="mt-2 text-fg-muted">{t("addDataBody")} <Link href="/app/data" className="underline underline-offset-4 font-medium">{t("addData")}</Link></p>
        ) : null}
      </Card>

      {plan && result ? (
        <Card className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
          <ScoreGauge score={result.overall} label={t("scoreLabel", { score: result.overall })} />
          <div>
            <p className="text-sm text-fg-muted">{t("latestScore", { date: formatDate(plan.checkup.createdAt) })}</p>
            <p className="text-3xl font-semibold">{tc(`grade.${result.grade}` as "grade.good")}</p>
            <p className="mt-1 text-sm text-fg-muted">{tc("confidence", { level: tc(`confidenceLevel.${result.confidence}`) })}</p>
            <p className="mt-2 text-sm"><Link href="/app/check-up" className="underline underline-offset-4">{t("viewCheckUp")}</Link></p>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold">{t("runFirstTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{incomes.length ? t("runFirstBody") : t("runFirstNoData")}</p>
          <div className="mt-3"><RunCheckUp first /></div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{tc("risks")}</h2>
          {result?.risks.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {result.risks.map((k) => {
                const d = result.dimensions.find((x) => x.key === k);
                return (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span>{tc(`dim.${k}.title`)}</span>
                    {d ? <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${statusClass(d.status)}`}>{tc(`status.${d.status}`)} · {d.score}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-2 text-sm text-fg-muted">{result ? t("noRisks") : t("afterCheckUp")}</p>}
        </Card>

        <Card>
          <h2 className="font-semibold">{t("nextSteps")}</h2>
          {next.length ? (
            <ol className="mt-2 space-y-1 text-sm list-decimal ps-5">
              {next.map((i) => <li key={i.id}><Link href={`/app/plan#item-${i.id}`} className="underline underline-offset-4">{tp(`titles.${i.template}`)}</Link>{i.scoreImpact > 0 ? <span className="text-fg-muted"> · {tc("impact", { points: i.scoreImpact })}</span> : null}</li>)}
            </ol>
          ) : <p className="mt-2 text-sm text-fg-muted">{plan ? t("allDone") : t("afterCheckUp")}</p>}
          {progress ? (
            <div className="mt-3">
              <ProgressBar pct={progress.pct} label={t("planProgress", { done: progress.done, total: progress.total })} />
              <p className="mt-1 text-xs text-fg-muted">{t("planProgress", { done: progress.done, total: progress.total })} · <Link href="/app/plan" className="underline underline-offset-4">{t("viewPlan")}</Link></p>
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">{t("goals")}</h2>
        {goals.length ? (
          <>
            <p className="mt-1 text-sm">{t("goalsSummary", { onTrack, total: goals.length })}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
              {goals.slice(0, 4).map((g, i) => (
                <li key={g.id}>
                  <div className="flex justify-between gap-2"><Link href={`/app/goals/${g.id}`} className="underline underline-offset-4">{g.name}</Link><span className="tabular-nums text-fg-muted">{projected[i].progressPct}%</span></div>
                  <div className="mt-1"><ProgressBar pct={projected[i].progressPct} label={`${g.name}: ${projected[i].progressPct}%`} /></div>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="mt-1 text-sm text-fg-muted">{t("noGoals")}</p>}
        <p className="mt-3 text-sm"><Link href={goals.length ? "/app/goals" : "/app/goals/new"} className="underline underline-offset-4">{goals.length ? t("viewGoals") : t("addGoal")}</Link></p>
      </Card>
    </div>
  );
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("app.dashboard");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={null}><Status searchParams={searchParams} /></Suspense>
      <Suspense fallback={null}><Overview locale={locale} /></Suspense>
    </>
  );
}
