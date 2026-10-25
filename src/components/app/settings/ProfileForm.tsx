"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateProfile } from "@/lib/account/actions";
import { CITY_TIERS, DISPLAY_LOCALES, EMPLOYMENT_TYPES, GENDERS, INDIAN_STATES, MARITAL_STATUSES, NUMBER_FORMATS, isRiskProfile } from "@/lib/account/profile";
import { Field, LocaleField, SubmitButton, inputClass, useForm } from "../forms";
import { Saved, SettingsError, selectClass } from "./common";

export type ProfileValues = {
  name: string; preferredName: string; dob: string; gender: string; maritalStatus: string; city: string; state: string; pin: string; cityTier: string;
  locale: string; numberFormat: string; employment: string; retirementAge: string; riskProfile: string | null; smoker: "" | "yes" | "no"; existingConditions: "" | "yes" | "no"; hasWill: "" | "yes" | "no";
};

const LOCALE_NAMES: Record<string, string> = { en: "English", ta: "தமிழ்" };

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const t = useTranslations("appSettings.profile");
  const to = useTranslations("appSettings.options");
  const ts = useTranslations("appSettings.states");
  const [state, action, pending] = useForm(updateProfile);

  const select = (key: keyof ProfileValues, label: string, options: readonly string[], labelFor: (v: string) => string, { blank = true, hint, name = key }: { blank?: boolean; hint?: string; name?: string } = {}) => (
    <Field id={name} label={label} hint={hint}>
      <select id={name} name={name} defaultValue={initial[key] ?? ""} className={selectClass} aria-describedby={hint ? `${name}-hint` : undefined}>
        {blank ? <option value="">{t("notSet")}</option> : null}
        {options.map((o) => <option key={o} value={o}>{labelFor(o)}</option>)}
      </select>
    </Field>
  );

  const yesNo = (name: "smoker" | "existingConditions" | "hasWill", label: string) => (
    <fieldset>
      <legend className="text-sm font-medium mb-1">{label}</legend>
      <div className="flex flex-wrap gap-3 text-sm">
        {(["", "yes", "no"] as const).map((v) => (
          <label key={v} className="inline-flex items-center gap-1.5">
            <input type="radio" name={name} value={v} defaultChecked={initial[name] === v} />
            <span>{v === "" ? t("notSet") : to(`yesNo.${v}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form action={action} className="space-y-8">
      <LocaleField />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("identity")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label={t("name")}>
            <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} defaultValue={initial.name} className={inputClass} />
          </Field>
          <Field id="preferredName" label={t("preferredName")} hint={t("preferredNameHint")}>
            <input id="preferredName" name="preferredName" type="text" autoComplete="nickname" maxLength={100} defaultValue={initial.preferredName} aria-describedby="preferredName-hint" className={inputClass} />
          </Field>
          <Field id="dob" label={t("dob")} hint={t("dobHint")}>
            <input id="dob" name="dob" type="date" autoComplete="bday" defaultValue={initial.dob} aria-describedby="dob-hint" className={inputClass} />
          </Field>
          {select("gender", t("gender"), GENDERS, (v) => to(`gender.${v}`))}
          {select("maritalStatus", t("maritalStatus"), MARITAL_STATUSES, (v) => to(`marital.${v}`))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("location")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" label={t("city")}>
            <input id="city" name="city" type="text" autoComplete="address-level2" maxLength={100} defaultValue={initial.city} className={inputClass} />
          </Field>
          {select("state", t("state"), INDIAN_STATES, (v) => ts(v))}
          <Field id="pin" label={t("pin")} hint={t("pinHint")}>
            <input id="pin" name="pin" type="text" inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} defaultValue={initial.pin} aria-describedby="pin-hint" className={inputClass} />
          </Field>
          {select("cityTier", t("cityTier"), CITY_TIERS, (v) => to(`cityTier.${v}`), { blank: false, hint: t("cityTierHint") })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("preferences")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {select("locale", t("language"), DISPLAY_LOCALES, (v) => LOCALE_NAMES[v] ?? v, { blank: false, hint: t("languageHint"), name: "displayLocale" })}
          {select("numberFormat", t("numberFormat"), NUMBER_FORMATS, (v) => to(`numberFormat.${v}`), { blank: false })}
        </div>
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm">
          <p>
            <span className="font-medium">{t("riskTolerance")}: </span>
            {isRiskProfile(initial.riskProfile) ? to(`risk.${initial.riskProfile}`) : t("notSet")}
          </p>
          <Link href="/app/settings/risk" className="mt-1 inline-block underline underline-offset-4">{initial.riskProfile ? t("riskRetake") : t("riskTake")}</Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("work")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {select("employment", t("employment"), EMPLOYMENT_TYPES, (v) => to(`employment.${v}`), { blank: false })}
          <Field id="retirementAge" label={t("retirementAge")} hint={t("retirementAgeHint")}>
            <input id="retirementAge" name="retirementAge" type="number" inputMode="numeric" min={40} max={80} defaultValue={initial.retirementAge} aria-describedby="retirementAge-hint" className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("health")}</h2>
        <p className="text-sm text-fg-muted">{t("healthHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {yesNo("smoker", t("smoker"))}
          {yesNo("existingConditions", t("existingConditions"))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("estate")}</h2>
        <p className="text-sm text-fg-muted">{t("estateHint")}</p>
        {yesNo("hasWill", t("hasWill"))}
      </section>

      <SettingsError error={state.error} />
      <Saved show={Boolean(state.ok)} text={t("saved")} />
      <SubmitButton label={t("save")} pending={pending} />
    </form>
  );
}
