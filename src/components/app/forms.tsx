"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ActionState } from "@/lib/auth/actions";

/** Shared building blocks for member-app forms: labelled fields, a submit button and error text keyed into messages. */
export const inputClass = "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-base";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ label, pending, tone = "primary" }: { label: string; pending: boolean; tone?: "primary" | "secondary" | "danger" }) {
  const cls = tone === "primary" ? "bg-accent text-white hover:bg-accent-strong" : tone === "danger" ? "bg-danger text-white hover:opacity-90" : "border border-border hover:bg-accent-soft";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-4 py-2 font-medium disabled:opacity-60 ${cls}`}>{label}</button>
  );
}

export function FormError({ error }: { error?: string }) {
  const t = useTranslations("app.errors");
  if (!error) return null;
  return <p role="alert" className="text-sm text-danger">{t(error as "generic")}</p>;
}

/** Hidden locale field so Server Actions know which language to redirect into. */
export function LocaleField() {
  const locale = useLocale();
  return <input type="hidden" name="locale" value={locale} />;
}

export function useForm(action: (prev: ActionState, form: FormData) => Promise<ActionState>) {
  return useActionState(action, {} as ActionState);
}
