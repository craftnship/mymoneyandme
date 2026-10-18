import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listItems, listMembers } from "@/lib/data/store";
import { buildSnapshot } from "@/lib/data/snapshot";
import { listGoals } from "@/lib/goals/store";
import { findConflicts, projectGoal } from "@/lib/goals/math";
import { formatINR, formatINRCompact } from "@/lib/format";
import { ProgressBar } from "@/components/app/checkup/ui";

export async function generateMetadata() {
  const t = await getTranslations("appCheckup.goals");
  return { title: t("title") };
}

async function GoalsDashboard({ locale }: { locale: string }) {
  const { user, household } = await requireHousehold(locale);
  const t = await getTranslations("appCheckup.goals");
  const [goals, members, items] = await Promise.all([listGoals(household.id), listMembers(household.id), listItems(household.id)]);
  const now = new Date();
  const projected = goals.map((g) => ({ ...g, projection: projectGoal({ ...g.payload, targetDate: g.targetDate }, now) }));
  const snapshot = buildSnapshot(user, members, items, goals, now);
  const surplus = Math.max(0, snapshot.monthlyIncome - snapshot.monthlyExpenses);
  const conflict = snapshot.provided?.includes("monthlyIncome") ? findConflicts(projected, surplus) : null;
  const onTrack = projected.filter((g) => g.projection.onTrack).length;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/goals/new" className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong">{t("new")}</Link>
        {goals.length ? <p className="text-sm text-fg-muted">{t("summary", { onTrack, total: goals.length })}</p> : null}
      </div>

      {conflict ? (
        <Notice tone="warning">
          <p className="font-medium">{t("conflict.title")}</p>
          <p className="mt-1">{t("conflict.body", { required: formatINR(Math.round(conflict.totalRequired)), surplus: formatINR(Math.round(conflict.surplus)) })}</p>
          {conflict.trimCandidates.length ? <p className="mt-1">{t("conflict.trim", { names: conflict.trimCandidates.map((c) => c.name).join(", ") })}</p> : null}
        </Notice>
      ) : null}

      {!goals.length ? (
        <Card>
          <h2 className="text-xl font-semibold">{t("noneTitle")}</h2>
          <p className="mt-2 text-fg-muted">{t("noneBody")}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projected.map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-bg-elevated p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium"><Link href={`/app/goals/${g.id}`} className="underline underline-offset-4">{g.name}</Link></h2>
                  <p className="text-xs text-fg-muted">{t(`template.${g.template}`)}{g.memberId && memberName(g.memberId) ? ` · ${memberName(g.memberId)}` : ""} · {t(`priority.${g.priority}`)}</p>
                </div>
                <Pill tone={g.projection.onTrack ? "accent" : g.projection.monthsAhead === null ? "danger" : "warn"}>{g.projection.onTrack ? t("onTrack") : t("behind")}</Pill>
              </div>
              <div className="mt-3"><ProgressBar pct={g.projection.progressPct} label={t("progressLabel", { name: g.name, pct: g.projection.progressPct })} /></div>
              <p className="mt-2 text-sm">{t("target", { amount: formatINRCompact(Math.round(g.projection.futureValue)), date: g.targetDate })}</p>
              <p className="text-xs text-fg-muted">
                {t("required", { amount: formatINR(Math.round(g.projection.requiredMonthlySip)) })} · {t("current", { amount: formatINR(Math.round(g.payload.monthlySip)) })}
              </p>
              <p className="text-xs text-fg-muted">
                {g.projection.monthsAhead === null ? t("neverReaches") : g.projection.monthsAhead >= 0 ? t("aheadBy", { months: g.projection.monthsAhead }) : t("behindBy", { months: -g.projection.monthsAhead })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {goals.length ? (
        <section aria-labelledby="timeline">
          <h2 id="timeline" className="text-lg font-semibold mb-2">{t("timeline")}</h2>
          <ol className="divide-y divide-border rounded-card border border-border bg-bg-elevated text-sm">
            {projected.map((g) => (
              <li key={g.id} className="flex flex-wrap gap-3 px-4 py-2">
                <span className="tabular-nums text-fg-muted">{g.targetDate}</span>
                <span>{g.name}</span>
                <span className="ms-auto tabular-nums">{formatINRCompact(Math.round(g.projection.futureValue))}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export default async function GoalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appCheckup.goals");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <GoalsDashboard locale={locale} />
      </Suspense>
    </>
  );
}
