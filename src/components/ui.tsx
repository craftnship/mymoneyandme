import type { ReactNode } from "react";

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`rounded-card border border-border bg-bg-elevated p-5 ${className}`}>{children}</div>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-bg border-border text-fg-muted",
    accent: "bg-accent-soft border-transparent text-accent-strong",
    warn: "bg-warn-soft border-transparent text-warn",
    danger: "bg-danger-soft border-transparent text-danger",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
      {intro ? <p className="mt-3 text-lg text-fg-muted max-w-3xl">{intro}</p> : null}
    </div>
  );
}

/** A tinted box. `size="body"` keeps the surrounding text size, for callouts inside articles and chapters. */
export function Notice({ tone, children, size = "small" }: { tone: "info" | "tip" | "warning"; children: ReactNode; size?: "small" | "body" }) {
  const cls = tone === "warning" ? "bg-warn-soft border-warn/30" : tone === "tip" ? "bg-accent-soft border-accent/30" : "bg-info-soft border-border";
  return <div className={`rounded-xl border ${size === "body" ? "px-5 py-4" : "px-4 py-3 text-sm"} ${cls}`}>{children}</div>;
}
