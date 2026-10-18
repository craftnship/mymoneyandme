"use client";

import { useTranslations } from "next-intl";
import { saveRiskProfile } from "@/lib/account/actions";
import { RISK_ANSWERS, RISK_QUESTIONS } from "@/lib/account/profile";
import { LocaleField, SubmitButton, useForm } from "../forms";
import { SettingsError } from "./common";

/** Five-question risk-tolerance questionnaire; the score is computed and stored server-side. */
export function RiskForm() {
  const t = useTranslations("appSettings.risk");
  const [state, action, pending] = useForm(saveRiskProfile);
  return (
    <form action={action} className="space-y-6">
      <LocaleField />
      {RISK_QUESTIONS.map((q, i) => (
        <fieldset key={q} className="space-y-2">
          <legend className="font-medium">{i + 1}. {t(`q.${q}.text`)}</legend>
          {RISK_ANSWERS.map((a) => (
            <label key={a} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-accent has-checked:bg-accent-soft">
              <input type="radio" name={q} value={a} required className="mt-1" />
              <span>{t(`q.${q}.a${a}`)}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <SettingsError error={state.error} />
      <SubmitButton label={t("submit")} pending={pending} />
    </form>
  );
}
