import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui";
import { formatINR, formatINRCompact } from "@/lib/format";
import { INDICATOR_KEYS, STRIP_FIELDS, snapshotDelta, type Indicator, type MoneySnapshot } from "@/lib/snapshots/compute";
import type { StoredSnapshot } from "@/lib/snapshots/store";
import { formatDate, statusClass } from "@/components/app/checkup/ui";

type T = Awaited<ReturnType<typeof getTranslations<"appDashboard">>>;

function hrefFor(family: string): string {
  return family === "netWorth" ? "/app/net-worth" : `/app/data/${family}`;
}

function signed(n: number, fmt: (v: number) => string): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
}

/** The month's figures, each linking to the records behind it, and what moved since last month. */
export async function SnapshotStrip({ current, previous }: { current: MoneySnapshot; previous?: StoredSnapshot }) {
  const t = await getTranslations("appDashboard.snapshot");
  const deltas = previous ? snapshotDelta(current, previous.snapshot) : [];
  const fmtDelta = (key: string, n: number) => {
    if (key === "emergencyMonths") return signed(n, (v) => t("months", { count: Math.round(v * 10) / 10 }));
    if (key === "score") return signed(n, (v) => t("points", { count: v }));
    return signed(n, (v) => formatINRCompact(v));
  };
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        {current.dataAsOf ? <p className="text-xs text-fg-muted">{t("asOf", { date: formatDate(current.dataAsOf) })}</p> : null}
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {STRIP_FIELDS.map((f) => {
          const v = current[f.key] as number;
          return (
            <div key={f.key} className={f.key === "netWorth" || f.key === "surplus" ? "border-s-2 border-accent ps-3" : ""}>
              <dt className="text-xs text-fg-muted">{t(`field.${f.key}` as "field.takeHome")}</dt>
              <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${v < 0 ? "text-danger" : ""}`}>{formatINRCompact(v)}</dd>
              <dd className="text-xs text-fg-muted">
                {f.monthly ? `${t("perMonth")} · ` : ""}
                <Link href={hrefFor(f.family)} className="underline underline-offset-2">{t("records")}</Link>
              </dd>
            </div>
          );
        })}
        <div>
          <dt className="text-xs text-fg-muted">{t("field.emergencyMonths")}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{t("months", { count: current.emergencyMonths })}</dd>
          <dd className="text-xs text-fg-muted"><Link href="/app/data/assets" className="underline underline-offset-2">{t("records")}</Link></dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-border pt-4 text-sm">
        {!previous ? (
          <p className="text-fg-muted">{t("noPrevious")}</p>
        ) : !deltas.length ? (
          <p className="text-fg-muted">{t("noChanges")}</p>
        ) : (
          <>
            <h3 className="font-medium">{t("sinceLastMonth", { month: previous.month })}</h3>
            <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {deltas.slice(0, 6).map((d) => (
                <li key={d.key} className="flex justify-between gap-3">
                  <span className="text-fg-muted">{t(`field.${d.key}` as "field.takeHome")}</span>
                  <span className={`tabular-nums font-medium ${(d.key === "liabilities" || d.key === "essentialSpend" || d.key === "discretionarySpend" || d.key === "emis") === d.change > 0 ? "text-danger" : "text-accent-strong"}`}>{fmtDelta(d.key, d.change)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-3 text-sm"><Link href="/app/net-worth" className="underline underline-offset-4">{t("netWorthView")}</Link></p>
    </Card>
  );
}

const INDICATOR_HREF: Record<Indicator["key"], string> = {
  emergency: "/app/data/assets",
  cashflow: "/app/data/expenses",
  debt: "/app/data/loans",
  goals: "/app/goals",
  retirement: "/app/data/investments",
  data: "/app/data",
};

function indicatorValue(i: Indicator, t: T, goals: MoneySnapshot["goals"]): string {
  if (i.status === "unknown" && i.key !== "data") return i.key === "goals" && goals.total === 0 ? t("indicators.goals.none") : t("indicators.unknown");
  const pct = Math.round(i.value * 100);
  switch (i.key) {
    case "emergency": return t("indicators.emergency.value", { count: Math.round(i.value * 10) / 10 });
    case "cashflow": return t("indicators.cashflow.value", { pct });
    case "debt": return t("indicators.debt.value", { pct });
    case "goals": return t("indicators.goals.value", { onTrack: goals.onTrack, total: goals.total });
    case "retirement": return t("indicators.retirement.value", { pct });
    case "data": return t("indicators.data.value", { pct });
  }
}

/** Six indicators, each with a plain definition and a link to the data that feeds it. Projections carry a dashed frame. */
export async function Indicators({ snapshot }: { snapshot: MoneySnapshot }) {
  const t = await getTranslations("appDashboard");
  const byKey = new Map(snapshot.indicators.map((i) => [i.key, i]));
  return (
    <section aria-labelledby="indicators-title">
      <h2 id="indicators-title" className="text-xl font-semibold">{t("indicators.title")}</h2>
      <p className="mt-1 text-sm text-fg-muted">{t("indicators.intro")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDICATOR_KEYS.map((key) => {
          const i = byKey.get(key);
          if (!i) return null;
          return (
            <Card key={key} className={i.projected ? "border-dashed" : ""}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t(`indicators.${key}.title`)}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(i.status)}`}>{t(`indicators.status.${i.status}`)}</span>
              </div>
              <p className={`mt-2 text-lg font-semibold tabular-nums ${i.status === "unknown" ? "text-fg-muted" : ""}`}>{indicatorValue(i, t, snapshot.goals)}</p>
              {i.projected ? <p className="text-xs italic text-fg-muted">{t("indicators.projected")}</p> : null}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-fg-muted">{t("indicators.definition")}</summary>
                <p className="mt-1 text-fg-muted">{t(`indicators.${key}.definition`)}</p>
                <p className="mt-1"><Link href={INDICATOR_HREF[key]} className="underline underline-offset-4">{t("indicators.source")}</Link></p>
              </details>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** A small inline line chart, server-rendered SVG. Values are plotted left to right; a flat series draws a mid line. */
export function Sparkline({ values, labels, title, format }: { values: number[]; labels: string[]; title: string; format: (v: number) => string }) {
  const w = 240;
  const h = 56;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const desc = `${title}: ${labels.map((l, i) => `${l} ${format(values[i])}`).join(", ")}`;
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-fg-muted">{title}</span>
        <span className="tabular-nums font-semibold">{format(last)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-14 w-full" role="img" aria-label={desc}>
        <polyline points={points} fill="none" stroke={last >= first ? "var(--accent)" : "var(--danger)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--bg-elevated)" stroke="var(--fg)" strokeWidth="1" />)}
      </svg>
      <div className="flex justify-between text-[10px] text-fg-muted"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
    </figure>
  );
}

/** Trend lines once two months exist, plus the month-by-month table. */
export async function Trends({ snapshots }: { snapshots: StoredSnapshot[] }) {
  const t = await getTranslations("appDashboard.trends");
  const rows = [...snapshots].sort((a, b) => (a.month < b.month ? -1 : 1));
  const labels = rows.map((r) => r.month);
  const series = (pick: (s: MoneySnapshot) => number) => rows.map((r) => pick(r.snapshot));
  const th = "px-3 py-2 text-start font-medium text-fg-muted";
  const td = "px-3 py-2 tabular-nums";
  return (
    <Card>
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {rows.length < 2 ? (
        <p className="mt-2 text-sm text-fg-muted">{t("waiting")}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-fg-muted">{t("intro")}</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <Sparkline title={t("netWorth")} values={series((s) => s.netWorth)} labels={labels} format={(v) => formatINRCompact(v)} />
            <Sparkline title={t("surplus")} values={series((s) => s.surplus)} labels={labels} format={(v) => formatINRCompact(v)} />
            <Sparkline title={t("emergencyMonths")} values={series((s) => s.emergencyMonths)} labels={labels} format={(v) => String(v)} />
            <Sparkline title={t("score")} values={series((s) => s.score)} labels={labels} format={(v) => String(v)} />
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-fg-muted">{t("table")}</summary>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr><th className={th}>{t("month")}</th><th className={th}>{t("netWorth")}</th><th className={th}>{t("surplus")}</th><th className={th}>{t("emergencyMonths")}</th><th className={th}>{t("score")}</th></tr></thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.month} className="border-t border-border"><td className="px-3 py-2 font-mono">{r.month}</td><td className={td}>{formatINR(r.snapshot.netWorth)}</td><td className={td}>{formatINR(r.snapshot.surplus)}</td><td className={td}>{r.snapshot.emergencyMonths}</td><td className={td}>{r.snapshot.score}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Card>
  );
}
