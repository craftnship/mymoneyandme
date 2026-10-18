"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { quickStart, type DataActionState } from "@/lib/data/actions";
import { CITY_TIERS, EMPLOYMENT, GENDERS, INDIAN_STATES, MARITAL } from "@/lib/data/fields";
import { AmountInput, DataField, FormLevelError, LocaleInput, Submit, describedBy, inputClass } from "./common";

export type QuickStartDefaults = {
  dob: string | null; gender: string | null; maritalStatus: string | null; dependants: number; city: string | null; state: string | null;
  pin: string | null; cityTier: 1 | 2 | 3; employment: string; monthlyIncome?: number; monthlyExpenses?: number;
};

export function QuickStartForm({ defaults, edit }: { defaults: QuickStartDefaults; edit: boolean }) {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(quickStart, {});
  const err = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-5">
      <LocaleInput />
      <DataField id="dob" label={t("welcome.dob")} error={err.dob}>
        <input id="dob" name="dob" type="date" required max={today} defaultValue={defaults.dob ?? ""} aria-invalid={Boolean(err.dob) || undefined} aria-describedby={describedBy("dob", false, Boolean(err.dob))} className={inputClass} />
      </DataField>
      <DataField id="gender" label={t("welcome.gender")} optional error={err.gender}>
        <select id="gender" name="gender" defaultValue={defaults.gender ?? ""} className={inputClass}>
          <option value="">{t("common.none")}</option>
          {GENDERS.map((g) => <option key={g} value={g}>{t(`options.gender.${g}`)}</option>)}
        </select>
      </DataField>
      <DataField id="maritalStatus" label={t("welcome.maritalStatus")} error={err.maritalStatus}>
        <select id="maritalStatus" name="maritalStatus" required defaultValue={defaults.maritalStatus ?? "single"} aria-invalid={Boolean(err.maritalStatus) || undefined} className={inputClass}>
          {MARITAL.map((m) => <option key={m} value={m}>{t(`options.maritalStatus.${m}`)}</option>)}
        </select>
      </DataField>
      <DataField id="dependants" label={t("welcome.dependants")} hint={t("welcome.dependantsHint")} error={err.dependants}>
        <input id="dependants" name="dependants" type="number" inputMode="numeric" min={0} max={20} step={1} required defaultValue={defaults.dependants} aria-describedby={describedBy("dependants", true, Boolean(err.dependants))} className={inputClass} />
      </DataField>
      <div className="grid gap-5 sm:grid-cols-2">
        <DataField id="city" label={t("welcome.city")} error={err.city}>
          <input id="city" name="city" type="text" required maxLength={100} autoComplete="address-level2" defaultValue={defaults.city ?? ""} aria-invalid={Boolean(err.city) || undefined} className={inputClass} />
        </DataField>
        <DataField id="state" label={t("welcome.state")} error={err.state}>
          <select id="state" name="state" required defaultValue={defaults.state ?? ""} aria-invalid={Boolean(err.state) || undefined} className={inputClass}>
            <option value="" disabled>{t("welcome.stateChoose")}</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </DataField>
      </div>
      <DataField id="pin" label={t("welcome.pin")} optional error={err.pin}>
        <input id="pin" name="pin" type="text" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" defaultValue={defaults.pin ?? ""} aria-invalid={Boolean(err.pin) || undefined} className={`${inputClass} sm:w-40`} />
      </DataField>
      <fieldset>
        <legend className="block text-sm font-medium mb-1">{t("welcome.cityTier")}</legend>
        <div className="flex flex-wrap gap-2">
          {CITY_TIERS.map((n) => (
            <label key={n} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="cityTier" value={n} defaultChecked={defaults.cityTier === n} required />
              {t("welcome.tier", { n })}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-fg-muted">{t("welcome.cityTierHint")}</p>
        {err.cityTier ? <p role="alert" className="mt-1 text-sm text-danger">{t(`errors.${err.cityTier}` as "errors.generic")}</p> : null}
      </fieldset>
      <DataField id="employment" label={t("welcome.employment")} error={err.employment}>
        <select id="employment" name="employment" required defaultValue={defaults.employment} className={inputClass}>
          {EMPLOYMENT.map((e) => <option key={e} value={e}>{t(`options.employment.${e}`)}</option>)}
        </select>
      </DataField>
      {edit ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <DataField id="monthlyIncome" label={t("welcome.monthlyIncome")} hint={t("welcome.monthlyIncomeHint")} error={err.monthlyIncome}>
            <AmountInput id="monthlyIncome" name="monthlyIncome" required defaultValue={defaults.monthlyIncome} max={1e9} invalid={Boolean(err.monthlyIncome)} describedBy={describedBy("monthlyIncome", true, Boolean(err.monthlyIncome))} />
          </DataField>
          <DataField id="monthlyExpenses" label={t("welcome.monthlyExpenses")} hint={t("welcome.monthlyExpensesHint")} error={err.monthlyExpenses}>
            <AmountInput id="monthlyExpenses" name="monthlyExpenses" required defaultValue={defaults.monthlyExpenses} max={1e9} invalid={Boolean(err.monthlyExpenses)} describedBy={describedBy("monthlyExpenses", true, Boolean(err.monthlyExpenses))} />
          </DataField>
        </div>
      )}
      <FormLevelError state={state} />
      <Submit label={edit ? t("welcome.saveProfile") : t("welcome.submit")} pending={pending} />
    </form>
  );
}
