"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatINRCompact } from "@/lib/format";
import type { DataActionState } from "@/lib/data/actions";

/**
 * Building blocks shared by the data-capture forms: a labelled field with an
 * inline error, an INR amount input with a lakh/crore helper, and the form
 * level error. Error values are message keys under appData.errors.
 */
export const inputClass = "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-base";

export function DataField({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  const t = useTranslations("appData");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}{optional ? <span className="text-fg-muted font-normal"> ({t("common.optional")})</span> : null}
      </label>
      {children}
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger">{t(`errors.${error}` as "errors.generic")}</p> : null}
    </div>
  );
}

export function describedBy(id: string, hint?: boolean, error?: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Number input for rupees; shows the lakh/crore reading as the user types. */
export function AmountInput({ id, name, defaultValue, required, describedBy: extra, invalid, max = 1e12 }: { id: string; name: string; defaultValue?: number; required?: boolean; describedBy?: string; invalid?: boolean; max?: number }) {
  const locale = useLocale();
  const [value, setValue] = useState<string>(defaultValue === undefined ? "" : String(defaultValue));
  const n = Number(value);
  const show = value !== "" && Number.isFinite(n) && n >= 1000;
  const helpId = `${id}-amount`;
  return (
    <div>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-fg-muted">₹</span>
        <input
          id={id} name={name} type="number" inputMode="decimal" min={0} max={max} step="any" required={required} value={value}
          onChange={(e) => setValue(e.target.value)} aria-invalid={invalid || undefined}
          aria-describedby={[extra, show ? helpId : null].filter(Boolean).join(" ") || undefined}
          className={`${inputClass} ps-7 tabular-nums`}
        />
      </div>
      {show ? <p id={helpId} className="mt-1 text-xs text-fg-muted tabular-nums">{formatINRCompact(n)} · {new Intl.NumberFormat(`${locale}-IN`, { maximumFractionDigits: 0, numberingSystem: "latn" }).format(n)}</p> : null}
    </div>
  );
}

export function FormLevelError({ state }: { state: DataActionState }) {
  const t = useTranslations("appData");
  if (!state.error && !state.fieldErrors?.form) return null;
  return <p role="alert" className="text-sm text-danger">{t(`errors.${state.error ?? state.fieldErrors?.form ?? "generic"}` as "errors.generic")}</p>;
}

export function Submit({ label, pending }: { label: string; pending: boolean }) {
  return <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">{label}</button>;
}

export function LocaleInput() {
  const locale = useLocale();
  return <input type="hidden" name="locale" value={locale} />;
}
