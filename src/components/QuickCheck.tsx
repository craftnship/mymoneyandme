"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useStoredState } from "@/lib/useStoredState";
import type { CheckUpResult } from "@/lib/checkup/engine";
import type { PlanItem } from "@/lib/checkup/plan";
import { formatINRCompact } from "@/lib/format";

type Answers = { age: number; monthlyIncome: number; monthlyExpenses: number; emergencySavings: number; monthlyEmi: number; hasTermCover: boolean; hasHealthCover: boolean };

const DEFAULTS: Answers = { age: 32, monthlyIncome: 100000, monthlyExpenses: 60000, emergencySavings: 150000, monthlyEmi: 15000, hasTermCover: false, hasHealthCover: false };
const STORAGE = "mm.quickcheck";

export function QuickCheck() {
  const t = useTranslations("checkup");
  const tc = useTranslations("calc");
  // Answers stay on this device (section 14: nothing is collected on the public site).
  const [a, setA] = useStoredState<Answers>(STORAGE, DEFAULTS);
  const [result, setResult] = useState<{ checkup: CheckUpResult; plan: PlanItem[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Scores are never computed client-side (section 18): the API records the rule-pack version.
      const res = await fetch("/api/checkup/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const num = (key: keyof Answers, label: string, min: number, max: number, step: number, currency = true) => (
    <div key={key}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`q-${key}`} className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1">
          {currency ? <span className="text-sm text-fg-muted">₹</span> : null}
          <input id={`q-${key}`} type="number" inputMode="numeric" className="w-32 rounded-lg border border-border bg-bg-elevated px-2 py-1 text-end tabular-nums" value={a[key] as number} min={min} max={max} step={step} onChange={(e) => setA({ ...a, [key]: Number(e.target.value) })} />
        </div>
      </div>
      <input type="range" aria-label={label} className="mt-2 w-full" min={min} max={max} step={step} value={a[key] as number} onChange={(e) => setA({ ...a, [key]: Number(e.target.value) })} />
      {currency ? <p className="text-xs text-fg-muted">{formatINRCompact(a[key] as number)}</p> : null}
    </div>
  );

  const yesNo = (key: "hasTermCover" | "hasHealthCover", label: string) => (
    <fieldset key={key}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex gap-2">
        {[true, false].map((v) => (
          <label key={String(v)} className={`rounded-lg border px-4 py-1.5 cursor-pointer ${a[key] === v ? "border-accent bg-accent-soft" : "border-border"}`}>
            <input type="radio" name={key} className="sr-only" checked={a[key] === v} onChange={() => setA({ ...a, [key]: v })} />
            {v ? t("q.yes") : t("q.no")}
          </label>
        ))}
      </div>
    </fieldset>
  );

  if (result) {
    const { checkup, plan } = result;
    return (
      <div className="space-y-8">
        <section className="rounded-card border border-border bg-bg-elevated p-6 grid gap-6 sm:grid-cols-[auto_1fr] items-center">
          <Gauge score={checkup.overall} />
          <div>
            <p className="text-sm text-fg-muted">{t("yourScore")} · {t("approximate")}</p>
            <p className="text-3xl font-semibold">{t(`grade.${checkup.grade}` as "grade.good")}</p>
            <p className="text-sm text-fg-muted mt-1">{t("confidence", { level: t(`confidenceLevel.${checkup.confidence}`) })} · {t("rulePack", { version: checkup.rulePackVersion })}</p>
            <button type="button" onClick={() => setResult(null)} className="mt-3 text-sm underline underline-offset-4">{t("rerun")}</button>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("dimensions")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {checkup.dimensions.map((d) => (
              <li key={d.key} className="rounded-xl border border-border bg-bg-elevated p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t(`dim.${d.key}.title`)}</p>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${d.status === "good" ? "bg-accent-soft text-accent-strong" : d.status === "watch" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger"}`}>{t(`status.${d.status}`)} · {d.score}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-bg border border-border overflow-hidden"><div className="h-full bg-accent" style={{ width: `${d.score}%` }} /></div>
                <p className="mt-2 text-xs text-fg-muted">{t(`dim.${d.key}.why`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{t("plan")}</h2>
          <ol className="space-y-2">
            {plan.map((item, i) => (
              <li key={item.id} className="rounded-xl border border-border bg-bg-elevated p-4 flex gap-3">
                <span className="font-mono text-sm text-fg-muted pt-0.5">{i + 1}</span>
                <div className="flex-1">
                  <p>{t(`items.${item.template}` as "items.annualReview", fmtParams(item.params))}</p>
                  <p className="mt-1 text-xs text-fg-muted">
                    {t("effort", { minutes: item.effortMinutes })}{item.scoreImpact > 0 ? ` · ${t("impact", { points: item.scoreImpact })}` : ""}
                    {item.relatedCalculator ? <> · <Link href={`/calculators/${item.relatedCalculator}`} className="underline underline-offset-4">{tc(`names.${item.relatedCalculator}`)}</Link></> : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-card border border-accent/30 bg-accent-soft p-5">
          <p className="font-semibold">{t("signUpCta")}</p>
          <p className="text-sm text-fg-muted mt-1">{t("signUpBody")}</p>
        </section>
      </div>
    );
  }

  return (
    <form className="rounded-card border border-border bg-bg-elevated p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); run(); }}>
      {num("age", t("q.age"), 18, 75, 1, false)}
      {num("monthlyIncome", t("q.monthlyIncome"), 10000, 2000000, 5000)}
      {num("monthlyExpenses", t("q.monthlyExpenses"), 5000, 2000000, 5000)}
      {num("emergencySavings", t("q.emergencySavings"), 0, 10000000, 10000)}
      {num("monthlyEmi", t("q.monthlyEmi"), 0, 1000000, 1000)}
      {yesNo("hasTermCover", t("q.hasTermCover"))}
      {yesNo("hasHealthCover", t("q.hasHealthCover"))}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent text-white px-5 py-2.5 font-medium hover:bg-accent-strong disabled:opacity-60">{t("run")}</button>
    </form>
  );
}

function fmtParams(p: Record<string, number | string>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === "number" && v >= 1000 ? new Intl.NumberFormat("en-IN").format(v) : v;
  return out;
}

function Gauge({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <svg viewBox="0 0 120 120" className="size-32" role="img" aria-label={`${score}/100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--fg)">{score}</text>
    </svg>
  );
}
