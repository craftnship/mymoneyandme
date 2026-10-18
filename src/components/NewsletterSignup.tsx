"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type State = "idle" | "busy" | "pending" | "alreadyConfirmed" | "invalid" | "notConfigured" | "rateLimited" | "error";

/** Newsletter sign-up (section 4). Double opt-in: the form only ever produces a confirmation email. */
export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("newsletter");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/newsletter/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, locale }) });
      const data = (await res.json().catch(() => ({}))) as { outcome?: State };
      setState(data.outcome && data.outcome !== "busy" ? data.outcome : "error");
    } catch {
      setState("error");
    }
  };

  const done = state === "pending" || state === "alreadyConfirmed";
  return (
    <section aria-labelledby="newsletter-title" className={`rounded-card border border-accent/30 bg-accent-soft ${compact ? "p-5" : "p-6 md:p-8"}`}>
      <h2 id="newsletter-title" className={`font-semibold tracking-tight ${compact ? "text-lg" : "text-2xl"}`}>{t("title")}</h2>
      <p className="mt-1 text-fg-muted">{t("body")}</p>
      {done ? (
        <p role="status" className="mt-4 font-medium">{t(state === "pending" ? "checkInbox" : "alreadyConfirmed")}</p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="newsletter-email" className="sr-only">{t("emailLabel")}</label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2"
          />
          <button type="submit" disabled={state === "busy"} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">{t("subscribe")}</button>
          {state !== "idle" && state !== "busy" ? <p role="alert" className="w-full text-sm text-danger">{t(`error.${state}` as "error.invalid")}</p> : null}
          <p className="w-full text-xs text-fg-muted">{t("privacy")}</p>
        </form>
      )}
    </section>
  );
}
