import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui";
import { FIELD_FAMILIES, missingFields, type SnapshotField } from "@/lib/data/snapshot";
import { traceMetric, type TraceAssumption, type TraceInput } from "@/lib/checkup/trace";
import type { HouseholdSnapshot } from "@/lib/checkup/engine";
import { getRulePack } from "@/lib/rulepack";
import { formatINR, formatPercent } from "@/lib/format";
import { formatDate } from "./ui";

type T = Awaited<ReturnType<typeof getTranslations<"appCheckup">>>;

function formatInput(i: TraceInput, t: T): string {
  switch (i.kind) {
    case "inrMonthly": return `${formatINR(Math.round(i.value))} ${t("trace.perMonth")}`;
    case "inr": return formatINR(Math.round(i.value));
    case "percent": return formatPercent(i.value, 0);
    case "years": return String(Math.round(i.value));
    case "count": return String(i.value);
    case "bool": return i.value ? t("common.yes") : t("common.no");
  }
}

function formatAssumption(a: TraceAssumption): string {
  switch (a.kind) {
    case "percent": return formatPercent(a.value, 1);
    case "inr": return formatINR(a.value);
    case "multiple": return `${a.value}×`;
    case "years": case "age": return String(a.value);
  }
}

/** The "edit" link for an input: the data family it comes from, or the profile for personal facts. */
function editHref(field: TraceInput["field"]): string | null {
  const families = FIELD_FAMILIES[field as SnapshotField];
  if (families?.length) return `/app/data/${families[0]}`;
  if (field === "age" || field === "dependants" || field === "cityTier" || field === "employment") return "/app/welcome?edit=1";
  if (field === "retirementAge") return "/app/settings";
  if (field === "goals") return "/app/goals";
  if (field === "monthlyEssentialExpenses") return "/app/data/expenses";
  if (field === "highCostDebt" || field === "totalDebt") return "/app/data/loans";
  return null;
}

/**
 * "How we calculated this" for the metrics of one dimension: formula in
 * words, every input with its value and where to change it, and the planning
 * assumptions. Rendered from the stored snapshot, so it matches the score.
 */
export async function MetricTraces({ metrics, snapshot, rulePackVersion }: { metrics: string[]; snapshot: HouseholdSnapshot; rulePackVersion: string }) {
  const t = await getTranslations("appCheckup");
  const pack = getRulePack(rulePackVersion);
  const traces = metrics.map((m) => traceMetric(m, snapshot, pack)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (!traces.length) return null;
  return (
    <details className="mt-2 rounded-lg border border-border/70 bg-bg px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">{t("trace.summary")}</summary>
      <div className="mt-2 space-y-3">
        {traces.map((tr) => (
          <div key={tr.metric}>
            <p className="font-medium">{t(`checkup.metric.${tr.metric}` as "checkup.metric.savingsRate")}</p>
            <p className="text-fg-muted">{t(`trace.formula.${tr.metric}` as "trace.formula.savingsRate")}</p>
            <dl className="mt-1 space-y-0.5">
              {tr.inputs.map((i) => {
                const href = editHref(i.field);
                const estimated = tr.estimated.includes(i.field === "monthlyEssentialExpenses" ? "monthlyExpenses" : i.field);
                return (
                  <div key={i.field} className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-fg-muted">
                      {t(`trace.input.${i.field}` as "trace.input.monthlyIncome")}
                      {i.defaulted ? <span className="ms-1 rounded-full bg-warn-soft px-1.5 text-warn">{t("trace.defaulted")}</span> : null}
                      {estimated ? <span className="ms-1 rounded-full bg-warn-soft px-1.5 text-warn">{t("trace.estimate")}</span> : null}
                    </dt>
                    <dd className="tabular-nums">
                      {formatInput(i, t)}
                      {href ? <> · <Link href={href} className="underline underline-offset-2">{t("trace.edit")}</Link></> : null}
                    </dd>
                  </div>
                );
              })}
              {tr.assumptions.map((a) => (
                <div key={a.key} className="flex flex-wrap justify-between gap-x-3">
                  <dt className="text-fg-muted">{t(`trace.assumption.${a.key}` as "trace.assumption.inflationGeneral")}</dt>
                  <dd className="tabular-nums">{formatAssumption(a)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Provenance footer for a stored check-up: rule pack and review date, data age, estimates and defaults. */
export async function AboutNumbers({ snapshot, rulePackVersion, qualityIssues = 0 }: { snapshot: HouseholdSnapshot; rulePackVersion: string; qualityIssues?: number }) {
  const t = await getTranslations("appCheckup");
  const pack = getRulePack(rulePackVersion);
  const estimated = (snapshot.estimated ?? []) as SnapshotField[];
  const missing = missingFields(snapshot.provided, 16);
  const fieldNames = (fields: SnapshotField[]) => fields.map((f) => t(`checkup.field.${f}`)).join(", ");
  return (
    <Card className="text-sm">
      <h2 className="font-semibold">{t("trace.about.title")}</h2>
      <ul className="mt-2 space-y-1 text-fg-muted">
        <li>{pack.reviewedOn ? t("trace.about.rulePack", { version: pack.version, date: pack.reviewedOn }) : t("checkup.rulePackOnly", { version: pack.version })}</li>
        <li>{snapshot.dataAsOf ? t("trace.about.dataAsOf", { date: formatDate(snapshot.dataAsOf) }) : t("trace.about.noData")}</li>
        <li>{estimated.length ? t("trace.about.estimated", { fields: fieldNames(estimated) }) : t("trace.about.noEstimates")}</li>
        {missing.length ? <li>{t("trace.about.missing", { fields: fieldNames(missing) })} <Link href="/app/data" className="underline underline-offset-4">{t("checkup.addData")}</Link></li> : null}
        {qualityIssues > 0 ? <li>{t("trace.quality.issues", { count: qualityIssues })} <Link href="/app/data#quality" className="underline underline-offset-4">{t("trace.quality.link")}</Link></li> : null}
      </ul>
      <RuleSources version={rulePackVersion} />
    </Card>
  );
}

/** The pages each figure in the rule pack was checked against. Shared by the check-up and calculator pages. */
export async function RuleSources({ version, keys }: { version?: string; keys?: string[] }) {
  const t = await getTranslations("appCheckup.trace.sources");
  const pack = getRulePack(version);
  const entries = Object.entries(pack.sources ?? {}).filter(([k]) => !keys || keys.some((prefix) => k === prefix || k.startsWith(`${prefix}.`)));
  if (!entries.length) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-medium">{t("summary")}</summary>
      <ul className="mt-2 space-y-1.5">
        {entries.map(([key, s]) => (
          <li key={key}>
            <span className="font-medium">{t.has(`key.${key.replace(/\./g, "-")}`) ? t(`key.${key.replace(/\./g, "-")}` as "key.assumptions") : key}</span>:{" "}
            {s.url ? <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2">{s.title}</a> : s.title}
            {" "}<span className="text-fg-muted">({t("verified", { date: s.verifiedOn })})</span>
            {s.note ? <span className="block text-fg-muted">{s.note}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
