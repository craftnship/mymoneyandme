"use client";

import { useTranslations } from "next-intl";
import { resendVerification } from "@/lib/auth/actions";
import { useForm } from "./forms";

export function ResendVerification() {
  const t = useTranslations("app.auth");
  const [state, action, pending] = useForm(resendVerification);
  if (state.ok) return <span role="status">{t("verificationSent")}</span>;
  return (
    <form action={action} className="inline">
      <button type="submit" disabled={pending} className="underline underline-offset-4 disabled:opacity-60">{t("resendVerification")}</button>
      {state.error ? <span role="alert" className="ms-2 text-danger">{t(`error.${state.error}` as "error.rateLimited")}</span> : null}
    </form>
  );
}
