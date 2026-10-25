"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { firstLook, type DataActionState } from "@/lib/data/actions";
import { useStoredState } from "@/lib/useStoredState";
import { AmountInput, DataField, FormLevelError, LocaleInput, Submit, describedBy } from "./common";

const COVER = ["yes", "no", "notSure"] as const;

/** Answers the public quick check keeps in localStorage (see QuickCheck.tsx); absent until the visitor has used it. */
type QuickCheckAnswers = { monthlyIncome?: number; monthlyExpenses?: number; emergencySavings?: number; hasTermCover?: boolean; hasHealthCover?: boolean };

const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

/**
 * The short first run: two amounts, savings if known, and two cover questions. Everything else comes later.
 * When the visitor already answered the public quick check on this device, those answers are filled in so
 * nothing has to be typed twice; the stored value arrives after hydration, so the fields are keyed on it.
 */
export function FirstLookForm() {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(firstLook, {});
  const err = state.fieldErrors ?? {};
  const [quick] = useStoredState<QuickCheckAnswers | null>("mm.quickcheck", null);
  const pre = quick ? { income: amount(quick.monthlyIncome), expenses: amount(quick.monthlyExpenses), savings: amount(quick.emergencySavings), term: quick.hasTermCover, health: quick.hasHealthCover } : null;
  const prefilled = Boolean(pre && (pre.income !== undefined || pre.expenses !== undefined));
  const coverDefault = (answer: boolean | undefined) => (answer === true ? "yes" : answer === false ? "no" : "notSure");
  const cover = (name: "termCover" | "healthCover", answer: boolean | undefined) => (
    <fieldset>
      <legend className="block text-sm font-medium mb-1">{t(`welcome.first.${name}`)}</legend>
      <div className="flex flex-wrap gap-2">
        {COVER.map((v) => (
          <label key={v} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name={name} value={v} defaultChecked={v === coverDefault(answer)} />
            {t(`welcome.first.${v}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <form key={prefilled ? "quick" : "blank"} action={action} className="space-y-5">
      <LocaleInput />
      {prefilled ? <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{t("welcome.first.prefilled")}</p> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <DataField id="monthlyIncome" label={t("welcome.monthlyIncome")} hint={t("welcome.monthlyIncomeHint")} error={err.monthlyIncome}>
          <AmountInput id="monthlyIncome" name="monthlyIncome" defaultValue={pre?.income} required max={1e9} invalid={Boolean(err.monthlyIncome)} describedBy={describedBy("monthlyIncome", true, Boolean(err.monthlyIncome))} />
        </DataField>
        <DataField id="monthlyExpenses" label={t("welcome.monthlyExpenses")} hint={t("welcome.monthlyExpensesHint")} error={err.monthlyExpenses}>
          <AmountInput id="monthlyExpenses" name="monthlyExpenses" defaultValue={pre?.expenses} required max={1e9} invalid={Boolean(err.monthlyExpenses)} describedBy={describedBy("monthlyExpenses", true, Boolean(err.monthlyExpenses))} />
        </DataField>
      </div>
      <DataField id="emergencySavings" label={t("welcome.first.emergencySavings")} hint={t("welcome.first.emergencySavingsHint")} optional error={err.emergencySavings}>
        <AmountInput id="emergencySavings" name="emergencySavings" defaultValue={pre?.savings} invalid={Boolean(err.emergencySavings)} describedBy={describedBy("emergencySavings", true, Boolean(err.emergencySavings))} />
      </DataField>
      {cover("termCover", pre?.term)}
      {cover("healthCover", pre?.health)}
      <FormLevelError state={state} />
      <Submit label={t("welcome.submit")} pending={pending} />
    </form>
  );
}
