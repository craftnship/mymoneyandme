import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listMembers } from "@/lib/data/store";
import { getGoal } from "@/lib/goals/store";
import { archiveGoalAction } from "@/lib/goals/actions";
import { projectGoal } from "@/lib/goals/math";
import { formatINR, formatINRCompact, formatPercent } from "@/lib/format";
import { GoalForm } from "@/components/app/checkup/GoalForm";
import { isoDateFromNow } from "@/lib/checkup/progress";
import { ProgressBar } from "@/components/app/checkup/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;


export async function generateMetadata() {
  const t = await getTranslations("appCheckup.goals");
  return { title: t("detailTitle") };
}

async function GoalDetail({ locale, id, searchParams }: { locale: string; id: string; searchParams: SearchParams }) {
  const { household } = await requireHousehold(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [goal, members, saved] = await Promise.all([getGoal(household.id, id), listMembers(household.id), searchParams.then((p) => p.saved)]);
  if (!goal) notFound();
  const t = await getTranslations("appCheckup.goals");
  const p = projectGoal({ ...goal.payload, targetDate: goal.targetDate });
  const rows: [string, string][] = [
    [t("detail.futureValue"), formatINR(Math.round(p.futureValue))],
    [t("detail.months"), String(p.months)],
    [t("detail.mix"), t("detail.mixValue", { horizon: t(`detail.horizon.${p.mix.horizon}`), equity: Math.round(p.mix.equity * 100), debt: Math.round(p.mix.debt * 100), liquid: Math.round(p.mix.liquid * 100) })],
    [t("detail.expectedReturn"), formatPercent(p.expectedReturn)],
    [t("detail.projected"), formatINR(Math.round(p.projected))],
    [t("detail.requiredSip"), formatINR(Math.round(p.requiredMonthlySip))],
    [p.shortfall > 0 ? t("detail.shortfall") : t("detail.surplus"), formatINR(Math.round(p.shortfall > 0 ? p.shortfall : p.projected - p.futureValue))],
  ];

  return (
    <div className="space-y-6">
      {saved ? <Notice tone="tip">{t("saved")}</Notice> : null}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{goal.name}</h2>
            <p className="text-sm text-fg-muted">{t(`template.${goal.template}`)} · {t(`priority.${goal.priority}`)} · {t("target", { amount: formatINRCompact(Math.round(p.futureValue)), date: goal.targetDate })}</p>
          </div>
          <Pill tone={p.onTrack ? "accent" : p.monthsAhead === null ? "danger" : "warn"}>{p.onTrack ? t("onTrack") : t("behind")}</Pill>
        </div>
        <div className="mt-3"><ProgressBar pct={p.progressPct} label={t("progressLabel", { name: goal.name, pct: p.progressPct })} /></div>
        <p className="mt-2 text-sm text-fg-muted">{p.monthsAhead === null ? t("neverReaches") : p.monthsAhead >= 0 ? t("aheadBy", { months: p.monthsAhead }) : t("behindBy", { months: -p.monthsAhead })}</p>
        <dl className="mt-4 grid gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="tabular-nums font-medium text-end">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-fg-muted">{t("detail.note")}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">{t("edit")}</h2>
        <GoalForm members={members.map((m) => ({ id: m.id, name: m.name }))} goal={goal} minDate={isoDateFromNow()} />
      </Card>

      <form action={archiveGoalAction} className="flex items-center gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={goal.id} />
        <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft">{t("archive")}</button>
        <span className="text-xs text-fg-muted">{t("archiveHint")}</span>
      </form>
    </div>
  );
}

export default async function GoalPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: SearchParams }) {
  const { locale, id } = await params;
  const t = await getTranslations("appCheckup.goals");
  return (
    <div className="max-w-2xl">
      <p className="text-sm text-fg-muted mb-2"><Link href="/app/goals" className="underline underline-offset-4">{t("back")}</Link></p>
      <PageTitle title={t("detailTitle")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <GoalDetail locale={locale} id={id} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
