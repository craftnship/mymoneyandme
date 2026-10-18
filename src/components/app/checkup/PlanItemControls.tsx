"use client";

import { useActionState, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setPlanStatusAction, type CheckUpActionState } from "@/lib/checkup/actions";
import { PLAN_STATUSES, type PlanStatus } from "@/lib/checkup/progress";
import { inputClass } from "@/components/app/forms";

/**
 * Status control for one plan item: to do, in progress, done, skipped (with a
 * reason) or snoozed (until a date). Submits through a Server Action and
 * redirects back to the plan, so it also works without JavaScript.
 */
export function PlanItemControls({ itemId, status, skipReason, snoozedUntil, minDate }: { itemId: string; status: PlanStatus; skipReason: string | null; snoozedUntil: string | null; minDate: string }) {
  const t = useTranslations("appCheckup.plan");
  const te = useTranslations("appCheckup.errors");
  const locale = useLocale();
  const uid = useId();
  const [chosen, setChosen] = useState<PlanStatus>(status);
  const [state, action, pending] = useActionState(setPlanStatusAction, {} as CheckUpActionState);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="itemId" value={itemId} />
      <div>
        <label htmlFor={`${uid}-status`} className="block text-xs font-medium text-fg-muted mb-1">{t("statusLabel")}</label>
        <select id={`${uid}-status`} name="status" value={chosen} onChange={(e) => setChosen(e.target.value as PlanStatus)} className={`${inputClass} text-sm py-1.5`}>
          {PLAN_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      </div>
      {chosen === "skipped" ? (
        <div className="min-w-48 flex-1">
          <label htmlFor={`${uid}-reason`} className="block text-xs font-medium text-fg-muted mb-1">{t("skipReason")}</label>
          <input id={`${uid}-reason`} name="skipReason" type="text" required maxLength={255} defaultValue={skipReason ?? ""} className={`${inputClass} text-sm py-1.5`} />
        </div>
      ) : null}
      {chosen === "snoozed" ? (
        <div>
          <label htmlFor={`${uid}-until`} className="block text-xs font-medium text-fg-muted mb-1">{t("snoozeUntil")}</label>
          <input id={`${uid}-until`} name="snoozedUntil" type="date" required min={minDate} defaultValue={snoozedUntil ?? ""} className={`${inputClass} text-sm py-1.5`} />
        </div>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent-soft disabled:opacity-60">{t("update")}</button>
      {state.error ? <p role="alert" className="basis-full text-sm text-danger">{te(state.error as "generic")}</p> : null}
    </form>
  );
}
