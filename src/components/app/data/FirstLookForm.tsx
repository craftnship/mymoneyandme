"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { firstLook, type DataActionState } from "@/lib/data/actions";
import { AmountInput, DataField, FormLevelError, LocaleInput, Submit, describedBy } from "./common";

const COVER = ["yes", "no", "notSure"] as const;

/** The short first run: two amounts, savings if known, and two cover questions. Everything else comes later. */
export function FirstLookForm() {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(firstLook, {});
  const err = state.fieldErrors ?? {};
  const cover = (name: "termCover" | "healthCover") => (
    <fieldset>
      <legend className="block text-sm font-medium mb-1">{t(`welcome.first.${name}`)}</legend>
      <div className="flex flex-wrap gap-2">
        {COVER.map((v) => (
          <label key={v} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name={name} value={v} defaultChecked={v === "notSure"} />
            {t(`welcome.first.${v}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <form action={action} className="space-y-5">
      <LocaleInput />
      <div className="grid gap-5 sm:grid-cols-2">
        <DataField id="monthlyIncome" label={t("welcome.monthlyIncome")} hint={t("welcome.monthlyIncomeHint")} error={err.monthlyIncome}>
          <AmountInput id="monthlyIncome" name="monthlyIncome" required max={1e9} invalid={Boolean(err.monthlyIncome)} describedBy={describedBy("monthlyIncome", true, Boolean(err.monthlyIncome))} />
        </DataField>
        <DataField id="monthlyExpenses" label={t("welcome.monthlyExpenses")} hint={t("welcome.monthlyExpensesHint")} error={err.monthlyExpenses}>
          <AmountInput id="monthlyExpenses" name="monthlyExpenses" required max={1e9} invalid={Boolean(err.monthlyExpenses)} describedBy={describedBy("monthlyExpenses", true, Boolean(err.monthlyExpenses))} />
        </DataField>
      </div>
      <DataField id="emergencySavings" label={t("welcome.first.emergencySavings")} hint={t("welcome.first.emergencySavingsHint")} optional error={err.emergencySavings}>
        <AmountInput id="emergencySavings" name="emergencySavings" invalid={Boolean(err.emergencySavings)} describedBy={describedBy("emergencySavings", true, Boolean(err.emergencySavings))} />
      </DataField>
      {cover("termCover")}
      {cover("healthCover")}
      <FormLevelError state={state} />
      <Submit label={t("welcome.submit")} pending={pending} />
    </form>
  );
}
