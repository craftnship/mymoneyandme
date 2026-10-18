import { formatINRCompact } from "@/lib/format";
import { METRIC_KINDS } from "@/lib/checkup/chapters";
import type { DimensionResult } from "@/lib/checkup/engine";

/** Shared, server-safe pieces for the check-up, plan, goals and dashboard pages. */
export function ScoreGauge({ score, label, size = "size-32" }: { score: number; label: string; size?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <svg viewBox="0 0 120 120" className={size} role="img" aria-label={label}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--fg)">{score}</text>
    </svg>
  );
}

export function statusClass(status: DimensionResult["status"]) {
  return status === "good" ? "bg-accent-soft text-accent-strong" : status === "watch" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger";
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-2 rounded-full bg-bg border border-border overflow-hidden" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full bg-accent" style={{ width: `${v}%` }} />
    </div>
  );
}

export type MetricWords = { yes: string; no: string; months: (count: number) => string };

export function formatMetric(name: string, value: number, words: MetricWords): string {
  const kind = METRIC_KINDS[name] ?? "percent";
  switch (kind) {
    case "percent": return `${Math.round(value * 100)}%`;
    case "months": return words.months(Math.round(value * 10) / 10);
    case "multiple": return `${Math.round(value * 10) / 10}×`;
    case "bool": return value ? words.yes : words.no;
    case "inr": return formatINRCompact(Math.round(value));
  }
}

export function formatDate(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

export function formatEffort(minutes: number, t: (key: "effortMinutes" | "effortHours" | "effortDays", values: { count: number }) => string): string {
  if (minutes < 60) return t("effortMinutes", { count: minutes });
  if (minutes < 480) return t("effortHours", { count: Math.round(minutes / 60) });
  return t("effortDays", { count: Math.round(minutes / 480) });
}
