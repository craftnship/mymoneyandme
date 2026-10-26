"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CalculatorDef, InputDef } from "@/lib/calculators/types";
import { encodeInputs, runCalculator } from "@/lib/calculators";
import { formatINR, formatINRCompact, formatPercent, type Grouping } from "@/lib/format";
import { useStoredState } from "@/lib/useStoredState";

type Props = {
  def: CalculatorDef;
  defaults: Record<string, number>;
  initial: Record<string, number>;
  compact?: boolean;
};

export function Calculator({ def, defaults, initial, compact = false }: Props) {
  const t = useTranslations("calc");
  const locale = useLocale();
  const [inputs, setInputs] = useState<Record<string, number>>(initial);
  const [grouping, setGrouping] = useStoredState<Grouping>("mm.grouping", "indian");
  const [copied, setCopied] = useState(false);
  // One anonymous "calculator used" event per page view, sent the first time an input changes (section 29 of the companion spec).
  const counted = useRef(false);
  const change = (next: Record<string, number>) => {
    setInputs(next);
    if (counted.current) return;
    counted.current = true;
    try {
      const body = JSON.stringify({ name: "calculatorUsed", detail: def.slug, locale });
      if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    } catch {}
  };

  // Live recalculation on every change (section 6); the formula is cheap enough
  // to run synchronously on each render.
  const result = useMemo(() => runCalculator(def.slug, inputs), [def.slug, inputs]);

  const fmt = (v: number | string, kind: string) => {
    if (typeof v === "string") return t.has(`labels.${v}`) ? t(`labels.${v}`) : v;
    if (!Number.isFinite(v)) return "—";
    switch (kind) {
      case "currency": return compact || Math.abs(v) >= 1e7 ? formatINRCompact(v, grouping) : formatINR(v, { grouping, locale });
      case "percent": return formatPercent(v, 2);
      case "years": return `${Math.round(v * 10) / 10}`;
      case "months": return `${Math.round(v)}`;
      default: return new Intl.NumberFormat(`${locale}-IN`).format(Math.round(v * 100) / 100);
    }
  };

  const headline = def.outputs.find((o) => o.headline) ?? def.outputs[0];
  // Inside an article or chapter the calculator sits lighter: the answer first, the three main inputs, and the rest behind one toggle.
  const allRegular = def.inputs.filter((i) => !i.assumption);
  const regular = compact ? allRegular.slice(0, 3) : allRegular;
  const assumptions = compact ? [...allRegular.slice(3), ...def.inputs.filter((i) => i.assumption)] : def.inputs.filter((i) => i.assumption);

  const share = async () => {
    const url = `${location.origin}${location.pathname}?${encodeInputs(inputs)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <div className={`mt-4 grid gap-6 ${compact ? "" : "lg:grid-cols-[1fr_1.1fr]"}`}>
      <div className={`space-y-4 ${compact ? "order-2" : ""}`}>
        {regular.map((input) => (
          <Field key={input.key} input={input} value={inputs[input.key]} grouping={grouping} onChange={(v) => change({ ...inputs, [input.key]: v })} />
        ))}
        {assumptions.length ? (
          <details className="rounded-xl border border-border p-3" open={!compact}>
            <summary className="cursor-pointer font-medium text-sm">{compact && allRegular.length > 3 ? t("moreInputs") : t("assumptions")}</summary>
            <div className="mt-3 space-y-4">
              {assumptions.map((input) => (
                <Field key={input.key} input={input} value={inputs[input.key]} grouping={grouping} onChange={(v) => change({ ...inputs, [input.key]: v })} />
              ))}
            </div>
          </details>
        ) : null}
        <div className="flex flex-wrap gap-2 text-sm no-print">
          <button type="button" onClick={() => setInputs(defaults)} className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent-soft">{t("reset")}</button>
          <button type="button" onClick={share} className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent-soft">{copied ? t("copied") : t("share")}</button>
          {!compact ? <button type="button" onClick={() => window.print()} className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent-soft">{t("print")}</button> : null}
          <label className="ms-auto inline-flex items-center gap-2 text-xs text-fg-muted">
            {t("groupingToggle")}
            <select value={grouping} onChange={(e) => setGrouping(e.target.value as Grouping)} className="rounded-md border border-border bg-bg-elevated px-1.5 py-1">
              <option value="indian">{t("indian")}</option>
              <option value="international">{t("international")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className={`space-y-4 ${compact ? "order-1" : ""}`}>
        <div className="rounded-card bg-accent-soft border border-accent/20 p-5">
          <p className="text-sm text-accent-strong font-medium">{t(`labels.${headline.label}`)}</p>
          <p className="text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums mt-1" aria-live="polite">{fmt(result.values[headline.key], headline.kind)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {def.outputs.filter((o) => o !== headline).map((o) => (
            <div key={o.key} className="rounded-xl border border-border p-3">
              <dt className="text-xs text-fg-muted">{t(`labels.${o.label}`)}</dt>
              <dd className="font-semibold mt-0.5 tabular-nums">{fmt(result.values[o.key], o.kind)}</dd>
            </div>
          ))}
        </dl>
        {def.chart === "split" && result.split ? <SplitBar parts={result.split} label={(k) => t(`labels.${k}`)} fmt={(v) => formatINRCompact(v, grouping)} /> : null}
        {(def.chart === "growth" || def.chart === "amortisation") && result.series?.length ? (
          <GrowthChart series={result.series} kind={def.chart} label={(k) => t(`labels.${k}`)} fmt={(v) => formatINRCompact(v, grouping)} />
        ) : null}
        {!compact && result.series?.length ? (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-medium text-sm">{t("breakdown")}</summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead><tr><th className="text-start py-1">{t("year")}</th>{Object.keys(result.series[0]).filter((k) => k !== "period").map((k) => <th key={k} className="text-end py-1">{t(`labels.${k}`)}</th>)}</tr></thead>
                <tbody>
                  {result.series.map((row) => (
                    <tr key={row.period} className="border-t border-border"><td className="py-1">{row.period}</td>{Object.keys(row).filter((k) => k !== "period").map((k) => <td key={k} className="text-end py-1 tabular-nums">{formatINRCompact(row[k], grouping)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
        {!compact ? (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-medium text-sm">{t("howItWorks")}</summary>
            <p className="mt-2 text-sm text-fg-muted">{t.has(`explain.${def.formula}`) ? t(`explain.${def.formula}`) : t("explain.default")}</p>
          </details>
        ) : null}
        <p className="text-xs text-fg-muted">{t("disclaimer")} · {result.rulePackVersion}</p>
      </div>
    </div>
  );
}

function Field({ input, value, grouping, onChange }: { input: InputDef; value: number; grouping: Grouping; onChange: (v: number) => void }) {
  const t = useTranslations("calc");
  const id = `in-${input.key}`;
  const isPercent = input.kind === "percent";
  const display = isPercent ? Math.round(value * 10000) / 100 : value;

  if (input.kind === "select") {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium">{t(`labels.${input.label}`)}</label>
        <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-bg-elevated px-3 py-2">
          {input.options?.map((o) => <option key={o.value} value={o.value}>{t(`labels.${o.label}`)}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{t(`labels.${input.label}`)}</label>
        <div className="flex items-center gap-1">
          {input.kind === "currency" ? <span className="text-fg-muted text-sm">₹</span> : null}
          <input
            id={id}
            type="number"
            inputMode="decimal"
            className="w-32 rounded-lg border border-border bg-bg-elevated px-2 py-1 text-end tabular-nums"
            value={Number.isFinite(display) ? display : ""}
            min={isPercent ? (input.min ?? 0) * 100 : input.min}
            max={isPercent ? (input.max ?? 1) * 100 : input.max}
            step={isPercent ? (input.step ?? 0.01) * 100 : input.step}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(isPercent ? n / 100 : n); }}
          />
          {isPercent ? <span className="text-fg-muted text-sm">%</span> : null}
        </div>
      </div>
      {input.min !== undefined && input.max !== undefined ? (
        <input
          type="range"
          aria-label={t(`labels.${input.label}`)}
          className="mt-2 w-full"
          min={input.min}
          max={input.max}
          step={input.step ?? 1}
          value={Number.isFinite(value) ? value : input.min}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : null}
      {input.kind === "currency" && Number.isFinite(value) ? <p className="text-xs text-fg-muted mt-0.5">{formatINRCompact(value, grouping)}</p> : null}
    </div>
  );
}

function SplitBar({ parts, label, fmt }: { parts: { key: string; value: number }[]; label: (k: string) => string; fmt: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const colors = ["var(--accent)", "var(--warn)", "var(--fg-muted)"];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-border" role="img" aria-label={parts.map((p) => `${label(p.key)} ${fmt(p.value)}`).join(", ")}>
        {parts.map((p, i) => <div key={p.key} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: colors[i % colors.length] }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {parts.map((p, i) => <li key={p.key} className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />{label(p.key)}: {fmt(p.value)}</li>)}
      </ul>
    </div>
  );
}

function GrowthChart({ series, kind, label, fmt }: { series: { period: number; [k: string]: number }[]; kind: "growth" | "amortisation"; label: (k: string) => string; fmt: (v: number) => string }) {
  const keys = kind === "amortisation" ? ["principal", "interest"] : series[0].invested !== undefined ? ["invested", "gains"] : series[0].target !== undefined ? ["value", "target"] : ["value"];
  const stacked = kind === "amortisation" || keys[0] === "invested";
  const max = Math.max(...series.map((r) => (stacked ? keys.reduce((s, k) => s + Math.max(0, r[k] ?? 0), 0) : Math.max(...keys.map((k) => r[k] ?? 0))))) || 1;
  const W = 600;
  const H = 180;
  const n = series.length;
  const bw = Math.max(2, (W - 10) / n - 2);
  const colors = ["var(--accent)", "var(--warn)"];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" role="img" aria-label={keys.map(label).join(" / ")}>
        {series.map((r, i) => {
          const x = 5 + i * ((W - 10) / n);
          if (stacked) {
            let y = H - 20;
            return (
              <g key={r.period}>
                {keys.map((k, ki) => {
                  const h = (Math.max(0, r[k] ?? 0) / max) * (H - 30);
                  y -= h;
                  return <rect key={k} x={x} y={y} width={bw} height={h} fill={colors[ki]} rx={1} />;
                })}
                {n <= 30 || i % 5 === 0 ? <text x={x + bw / 2} y={H - 6} fontSize={9} textAnchor="middle" fill="var(--fg-muted)">{r.period}</text> : null}
              </g>
            );
          }
          return (
            <g key={r.period}>
              {keys.map((k, ki) => {
                const h = (Math.max(0, r[k] ?? 0) / max) * (H - 30);
                return <rect key={k} x={x + ki * (bw / keys.length)} y={H - 20 - h} width={bw / keys.length} height={h} fill={colors[ki]} rx={1} />;
              })}
              {n <= 30 || i % 5 === 0 ? <text x={x + bw / 2} y={H - 6} fontSize={9} textAnchor="middle" fill="var(--fg-muted)">{r.period}</text> : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {keys.map((k, i) => <span key={k} className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: colors[i] }} />{label(k)}</span>)}
        <span className="ms-auto">{fmt(max)}</span>
      </figcaption>
    </figure>
  );
}
