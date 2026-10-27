import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui";
import { chapterHref, DIMENSION_CHAPTERS } from "@/lib/checkup/chapters";
import { retirementExplanation } from "@/lib/checkup/explain";
import { encodeInputs } from "@/lib/calculators";
import type { StoredCheckUp } from "@/lib/checkup/store";
import type { CheckUpDiff } from "@/lib/checkup/progress";
import { missingFields } from "@/lib/data/snapshot";
import { formatDate, formatMetric, ScoreGauge, statusClass, statusLabel } from "./ui";
import { AboutNumbers, MetricTraces } from "./Trace";

/** Full rendering of one stored check-up: score, confidence, eight dimension cards, risks and strengths. */
export async function CheckUpReport({ checkup, qualityIssues = 0 }: { checkup: StoredCheckUp; qualityIssues?: number }) {
  const t = await getTranslations("appCheckup.checkup");
  const tc = await getTranslations("checkup");
  const tw = await getTranslations("appCheckup.common");
  const { result, snapshot } = checkup;
  const missing = missingFields(snapshot.provided, 4);
  const retirement = retirementExplanation(snapshot, result.rulePackVersion);
  const tcalc = await getTranslations("calc");
  const words = { yes: tw("yes"), no: tw("no"), months: (count: number) => tw("monthsShort", { count }) };

  return (
    <div className="space-y-8">
      <Card className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
        <ScoreGauge score={result.overall} label={t("scoreLabel", { score: result.overall })} />
        <div>
          <p className="text-sm text-fg-muted">{t("lastRun", { date: formatDate(checkup.createdAt) })}</p>
          <p className="text-3xl font-semibold">{tc(`grade.${result.grade}` as "grade.good")}</p>
          <p className="text-sm text-fg-muted mt-1">{tc("confidence", { level: tc(`confidenceLevel.${result.confidence}`) })} · {tc("rulePack", { version: result.rulePackVersion })}</p>
          {result.confidence !== "high" && missing.length ? (
            <p className="mt-2 text-sm">
              {t("raiseConfidence")}{" "}
              <span className="text-fg-muted">{missing.map((f) => t(`field.${f}`)).join(", ")}</span>
              {" · "}
              <Link href="/app/data" className="underline underline-offset-4">{t("addData")}</Link>
            </p>
          ) : null}
        </div>
      </Card>

      <section aria-labelledby="dims">
        <h2 id="dims" className="text-xl font-semibold mb-3">{tc("dimensions")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.dimensions.map((d) => (
            <li key={d.key} className="rounded-xl border border-border bg-bg-elevated p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{tc(`dim.${d.key}.title`)}</p>
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${statusClass(d.status)}`}>{statusLabel(d.status, d.score, tc(`status.${d.status}`))}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-bg border border-border overflow-hidden"><div className="h-full bg-accent" style={{ width: `${d.status === "unknown" ? 0 : d.score}%` }} /></div>
              <p className="mt-2 text-sm">
                {t(`verdict.${d.key}.${d.status}`)}
                {d.status === "unknown" ? <> <Link href={d.key === "goals" ? "/app/goals/new" : "/app/data"} className="underline underline-offset-4">{d.key === "goals" ? t("addGoal") : t("addData")}</Link></> : null}
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-y-1 text-xs">
                {Object.entries(d.metrics).map(([name, value]) => (
                  <div key={name} className="flex justify-between gap-2 border-b border-border/60 py-0.5">
                    <dt className="text-fg-muted">{t(`metric.${name}`)}</dt>
                    <dd className="tabular-nums font-medium">{formatMetric(name, value, words)}</dd>
                  </div>
                ))}
              </dl>
              {d.key === "retirement" && d.status !== "unknown" ? (
                <p className="mt-2 text-xs text-fg-muted">
                  {t("assumesRetirement", { ...retirement.params, expenses: new Intl.NumberFormat("en-IN").format(retirement.params.expenses) })}{" "}
                  <Link href={`/calculators/retirement-corpus?${encodeInputs(retirement.calculatorInputs)}`} className="underline underline-offset-4">{t("calculatorWithMyNumbers", { name: tcalc("names.retirement-corpus") })}</Link>
                </p>
              ) : null}
              <p className="mt-2 text-xs text-fg-muted">{tc(`dim.${d.key}.why`)} <Link href={chapterHref(DIMENSION_CHAPTERS[d.key])} className="underline underline-offset-4">{t("readChapter")}</Link></p>
              {d.status !== "unknown" ? <MetricTraces metrics={Object.keys(d.metrics)} snapshot={snapshot} rulePackVersion={result.rulePackVersion} /> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-muted">{t("weightNote", { weight: result.dimensions.map((d) => `${tc(`dim.${d.key}.title`)} ${d.weight}%`).join(" · ") })}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">{tc("risks")}</h2>
          {result.risks.length ? (
            <ol className="mt-2 space-y-1 list-decimal ps-5 text-sm">
              {result.risks.map((k) => <li key={k}>{tc(`dim.${k}.title`)}: {t(`verdict.${k}.${result.dimensions.find((d) => d.key === k)?.status ?? "act"}`)}</li>)}
            </ol>
          ) : <p className="mt-2 text-sm text-fg-muted">{t("noRisks")}</p>}
        </Card>
        <Card>
          <h2 className="font-semibold">{tc("strengths")}</h2>
          {result.strengths.length ? (
            <ol className="mt-2 space-y-1 list-decimal ps-5 text-sm">
              {result.strengths.map((k) => <li key={k}>{tc(`dim.${k}.title`)}: {t(`verdict.${k}.good`)}</li>)}
            </ol>
          ) : <p className="mt-2 text-sm text-fg-muted">{t("noStrengths")}</p>}
        </Card>
      </div>

      <AboutNumbers snapshot={snapshot} rulePackVersion={result.rulePackVersion} qualityIssues={qualityIssues} />
    </div>
  );
}

/** "What changed" between two runs: overall delta and the dimensions that moved. */
export async function WhatChanged({ diff, previousDate }: { diff: CheckUpDiff; previousDate: Date }) {
  const t = await getTranslations("appCheckup.checkup");
  const tc = await getTranslations("checkup");
  const moved = diff.dimensions.filter((d) => d.delta !== 0);
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <Card>
      <h2 className="font-semibold">{t("whatChanged", { date: formatDate(previousDate) })}</h2>
      <p className="mt-1 text-sm">
        {t("overallDelta", { from: diff.overall.from, to: diff.overall.to, delta: sign(diff.overall.delta) })}
        {diff.grade.changed ? ` · ${t("gradeChanged", { from: tc(`grade.${diff.grade.from}` as "grade.good"), to: tc(`grade.${diff.grade.to}` as "grade.good") })}` : ""}
      </p>
      {moved.length ? (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm">
          {moved.map((d) => (
            <li key={d.key} className="flex justify-between gap-2">
              <span>{tc(`dim.${d.key}.title`)}</span>
              <span className={`tabular-nums font-medium ${d.delta > 0 ? "text-accent-strong" : "text-danger"}`}>{d.from} → {d.to} ({sign(d.delta)})</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-fg-muted">{t("nothingChanged")}</p>}
    </Card>
  );
}
