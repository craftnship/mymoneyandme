"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { answerProfileStep, type DataActionState } from "@/lib/data/actions";
import type { ProfileStep } from "@/lib/data/forms";
import { CITY_TIERS, EMPLOYMENT } from "@/lib/data/fields";
import { DataField, FormLevelError, LocaleInput, inputClass } from "./common";

/** One profile question with Save and "Skip for now"; the page shows the next one after either. */
export function ProfileStepCard({ step, done, total }: { step: ProfileStep; done: number; total: number }) {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(answerProfileStep, {});
  const err = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="rounded-card border border-accent/30 bg-accent-soft p-5 space-y-3">
      <LocaleInput />
      <input type="hidden" name="step" value={step} />
      <p className="text-xs text-fg-muted">{t("welcome.step.progress", { n: done + 1, total })}</p>
      {step === "dob" ? (
        <DataField id="dob" label={t("welcome.dob")} hint={t("welcome.step.why.dob")} error={err.dob}>
          <input id="dob" name="dob" type="date" max={today} className={`${inputClass} sm:w-56`} />
        </DataField>
      ) : step === "employment" ? (
        <DataField id="employment" label={t("welcome.employment")} hint={t("welcome.step.why.employment")} error={err.employment}>
          <select id="employment" name="employment" defaultValue="salaried" className={`${inputClass} sm:w-72`}>
            {EMPLOYMENT.map((e) => <option key={e} value={e}>{t(`options.employment.${e}`)}</option>)}
          </select>
        </DataField>
      ) : step === "dependants" ? (
        <DataField id="dependants" label={t("welcome.dependants")} hint={t("welcome.dependantsHint")} error={err.dependants}>
          <input id="dependants" name="dependants" type="number" inputMode="numeric" min={0} max={20} step={1} defaultValue={0} className={`${inputClass} sm:w-32`} />
        </DataField>
      ) : (
        <fieldset>
          <legend className="block text-sm font-medium mb-1">{t("welcome.cityTier")}</legend>
          <div className="flex flex-wrap gap-2">
            {CITY_TIERS.map((n) => (
              <label key={n} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 cursor-pointer has-[:checked]:border-accent">
                <input type="radio" name="cityTier" value={n} defaultChecked={n === 1} />
                {t("welcome.tier", { n })}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-fg-muted">{t("welcome.cityTierHint")}</p>
        </fieldset>
      )}
      <FormLevelError state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">{t("common.save")}</button>
        <button type="submit" name="skip" value="1" disabled={pending} formNoValidate className="rounded-lg border border-border bg-bg-elevated px-4 py-2 font-medium hover:bg-bg disabled:opacity-60">{t("welcome.step.skip")}</button>
      </div>
    </form>
  );
}
