import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listItems, listMembers } from "@/lib/data/store";
import { planForHousehold } from "@/lib/checkup/planStore";
import { openItems, planProgress } from "@/lib/checkup/progress";
import { pickReminder } from "@/lib/reminders/pick";
import { listGoals } from "@/lib/goals/store";
import { projectGoal } from "@/lib/goals/math";
import { computeMoneySnapshot } from "@/lib/snapshots/compute";
import { listSnapshots, recordMonthlySnapshot } from "@/lib/snapshots/store";
import { RunCheckUp } from "@/components/app/checkup/RunCheckUp";
import { NextProfileStep } from "@/components/app/data/NextProfileStep";
import { formatDate, ProgressBar, ScoreGauge } from "@/components/app/checkup/ui";
import { Indicators, SnapshotStrip, Trends } from "@/components/app/dashboard/Snapshot";
import { formatINR, formatINRCompact } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Status({ searchParams }: { searchParams: SearchParams }) {
  const status = (await searchParams).status;
  const t = await getTranslations("app.auth");
  if (status === "verified") return <div className="mb-6"><Notice tone="tip">{t("verified")}</Notice></div>;
  if (status === "invalid") return <div className="mb-6"><Notice tone="warning">{t("linkInvalid")}</Notice></div>;
  return null;
}

/**
 * The money snapshot dashboard (spec section 7): this month's figures with
 * what changed, six indicators, the top three actions, the goals table and
 * trends. The snapshot is computed live from the records and this month's
 * stored row is written when it is missing, so history exists for members
 * who added their data before snapshots did.
 */
async function Overview({ locale }: { locale: string }) {
  const { user, household } = await requireHousehold(locale);
  const t = await getTranslations("appCheckup.dashboard");
  const tc = await getTranslations("checkup");
  const td = await getTranslations("app.dashboard");
  const tp = await getTranslations("appCheckup.plan");
  const tg = await getTranslations("appCheckup.goals");
  const ta = await getTranslations("appDashboard");
  const [plan, goals, items, members] = await Promise.all([planForHousehold(household.id), listGoals(household.id), listItems(household.id), listMembers(household.id)]);
  const now = new Date();
  const hasData = items.length > 0;
  const live = hasData ? computeMoneySnapshot(user, members, items, goals, now) : null;
  let stored = hasData ? await listSnapshots(household.id) : [];
  if (live && !stored.some((s) => s.month === live.month)) {
    await recordMonthlySnapshot(household.id, user.id, now);
    stored = await listSnapshots(household.id);
  }
  const previous = live ? stored.find((s) => s.month < live.month) : undefined;
  const projected = goals.map((g) => ({ goal: g, p: projectGoal({ ...g.payload, targetDate: g.targetDate }, now) }));
  const next = plan ? openItems(plan.items).slice(0, 3) : [];
  const progress = plan ? planProgress(plan.items) : null;
  const first = plan ? pickReminder(plan.checkup.result.overall, plan.items) : null;
  const result = plan?.checkup.result;
  const th = "px-3 py-2 text-start font-medium text-fg-muted";

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold">{td("hello", { name: user.preferredName ?? user.name })}</h2>
        {!hasData ? (
          <p className="mt-2 text-fg-muted">{t("addDataBody")} <Link href="/app/data" className="underline underline-offset-4 font-medium">{t("addData")}</Link></p>
        ) : null}
      </Card>

      {hasData ? <NextProfileStep user={user} /> : null}

      {live ? <SnapshotStrip current={live} previous={previous} /> : null}

      <div className="grid gap-4 lg:grid-cols-[auto_1fr] items-start">
        {plan && result ? (
          <Card className="flex items-center gap-5">
            <ScoreGauge score={result.overall} label={t("scoreLabel", { score: result.overall })} />
            <div>
              <p className="text-sm text-fg-muted">{t("latestScore", { date: formatDate(plan.checkup.createdAt) })}</p>
              <p className="text-2xl font-semibold">{tc(`grade.${result.grade}` as "grade.good")}</p>
              <p className="mt-1 text-sm text-fg-muted">{tc("confidence", { level: tc(`confidenceLevel.${result.confidence}`) })}</p>
              <p className="mt-2 text-sm"><Link href="/app/check-up" className="underline underline-offset-4">{t("viewCheckUp")}</Link></p>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="font-semibold">{t("runFirstTitle")}</h2>
            <p className="mt-1 text-sm text-fg-muted">{hasData ? t("runFirstBody") : t("runFirstNoData")}</p>
            <div className="mt-3"><RunCheckUp first /></div>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">{ta("actions.title")}</h2>
          {next.length ? (
            <ol className="mt-2 space-y-1.5 text-sm list-decimal ps-5">
              {next.map((i) => (
                <li key={i.id}>
                  <Link href={`/app/plan#item-${i.id}`} className="underline underline-offset-4">{tp(`titles.${i.template}`)}</Link>
                  {i.scoreImpact > 0 ? <span className="text-fg-muted"> · {ta("actions.impact", { points: i.scoreImpact })}</span> : null}
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-fg-muted">{plan ? ta("actions.allDone") : ta("actions.empty")}</p>}
          {first && plan && first.projected > plan.checkup.result.overall ? (
            <p className="mt-2 text-sm">{t("scoreAfterStep", { from: plan.checkup.result.overall, to: first.projected })}</p>
          ) : null}
          {progress ? (
            <div className="mt-3">
              <ProgressBar pct={progress.pct} label={t("planProgress", { done: progress.done, total: progress.total })} />
              <p className="mt-1 text-xs text-fg-muted">{t("planProgress", { done: progress.done, total: progress.total })} · <Link href="/app/plan" className="underline underline-offset-4">{ta("actions.viewPlan")}</Link></p>
            </div>
          ) : null}
        </Card>
      </div>

      {live ? <Indicators snapshot={live} /> : null}

      <Card>
        <h2 className="font-semibold">{ta("goalsTable.title")}</h2>
        {goals.length ? (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr><th className={th}>{ta("goalsTable.goal")}</th><th className={th}>{ta("goalsTable.date")}</th><th className={th}>{ta("goalsTable.target")}</th><th className={th}>{ta("goalsTable.progress")}</th><th className={th}>{ta("goalsTable.monthly")}</th><th className={th}>{ta("goalsTable.status")}</th></tr></thead>
                <tbody>
                  {projected.map(({ goal: g, p }) => (
                    <tr key={g.id} className="border-t border-border align-top">
                      <td className="px-3 py-2"><Link href={`/app/goals/${g.id}`} className="underline underline-offset-4">{g.name}</Link><span className="block text-xs text-fg-muted">{tg(`priority.${g.priority}`)}</span></td>
                      <td className="px-3 py-2 tabular-nums">{g.targetDate}</td>
                      <td className="px-3 py-2 tabular-nums italic">{formatINRCompact(Math.round(p.futureValue))}</td>
                      <td className="px-3 py-2 min-w-32"><ProgressBar pct={p.progressPct} label={`${g.name}: ${p.progressPct}%`} /><span className="text-xs tabular-nums italic text-fg-muted">{p.progressPct}%</span></td>
                      <td className="px-3 py-2 tabular-nums">{formatINR(Math.round(p.requiredMonthlySip))}</td>
                      <td className="px-3 py-2"><Pill tone={p.onTrack ? "accent" : p.monthsAhead === null ? "danger" : "warn"}>{p.onTrack ? ta("goalsTable.onTrack") : ta("goalsTable.behind")}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs italic text-fg-muted">{ta("goalsTable.projectedNote")}</p>
          </>
        ) : <p className="mt-1 text-sm text-fg-muted">{ta("goalsTable.empty")}</p>}
        <p className="mt-3 text-sm"><Link href={goals.length ? "/app/goals" : "/app/goals/new"} className="underline underline-offset-4">{goals.length ? ta("goalsTable.all") : ta("goalsTable.add")}</Link></p>
      </Card>

      {hasData ? <Trends snapshots={stored} /> : null}
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
