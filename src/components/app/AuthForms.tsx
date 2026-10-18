"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset, resetPassword, signIn, signUp } from "@/lib/auth/actions";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { Field, FormError, LocaleField, SubmitButton, inputClass, useForm } from "./forms";
import { PasskeyButton } from "./Passkeys";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("app.auth");
  const [state, action, pending] = useForm(signIn);
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field id="email" label={t("email")}>
        <input id="email" name="email" type="email" autoComplete="username webauthn" required className={inputClass} />
      </Field>
      <Field id="password" label={t("password")}>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <FormError error={state.error} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={t("signIn")} pending={pending} />
        <PasskeyButton next={next} />
        <Link href="/app/forgot" className="text-sm underline underline-offset-4">{t("forgot")}</Link>
      </div>
      <p className="text-sm text-fg-muted">
        {t("noAccount")} <Link href="/app/sign-up" className="underline underline-offset-4">{t("createAccount")}</Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const t = useTranslations("app.auth");
  const [state, action, pending] = useForm(signUp);
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        {t("existsNotice")} <Link href="/app/sign-in" className="underline underline-offset-4">{t("signIn")}</Link>
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <Field id="name" label={t("name")}>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} className={inputClass} />
      </Field>
      <Field id="email" label={t("email")}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint", { min: PASSWORD_MIN })}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} aria-describedby="password-hint" className={inputClass} />
      </Field>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-1" />
        <span>
          {t.rich("terms", {
            terms: (c) => <Link href="/legal/terms" className="underline underline-offset-4">{c}</Link>,
            privacy: (c) => <Link href="/legal/privacy" className="underline underline-offset-4">{c}</Link>,
          })}
        </span>
      </label>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="analytics" className="mt-1" />
        <span>{t("consentAnalytics")}</span>
      </label>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="marketing" className="mt-1" />
        <span>{t("consentMarketing")}</span>
      </label>
      <FormError error={state.error} />
      <SubmitButton label={t("createAccount")} pending={pending} />
      <p className="text-sm text-fg-muted">
        {t("haveAccount")} <Link href="/app/sign-in" className="underline underline-offset-4">{t("signIn")}</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations("app.auth");
  const [state, action, pending] = useForm(requestPasswordReset);
  if (state.ok) return <p role="status" className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">{t("resetSent")}</p>;
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <Field id="email" label={t("email")}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton label={t("sendReset")} pending={pending} />
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("app.auth");
  const [state, action, pending] = useForm(resetPassword);
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <input type="hidden" name="token" value={token} />
      <Field id="password" label={t("newPassword")} hint={t("passwordHint", { min: PASSWORD_MIN })}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={inputClass} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton label={t("setPassword")} pending={pending} />
    </form>
  );
}
