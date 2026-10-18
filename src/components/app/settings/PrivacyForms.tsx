"use client";

import { useTranslations } from "next-intl";
import { cancelDeletion, requestDeletion, updateConsents } from "@/lib/account/actions";
import type { ConsentKind } from "@/lib/auth/users";
import { LocaleField, SubmitButton, useForm } from "../forms";
import { Saved, SettingsError } from "./common";

export type ConsentRow = { kind: ConsentKind; granted: boolean; decidedAt: string | null };

export function ConsentForm({ rows }: { rows: ConsentRow[] }) {
  const t = useTranslations("appSettings.privacy");
  const [state, action, pending] = useForm(updateConsents);
  const decided = rows.filter((r) => r.decidedAt).map((r) => r.kind).join(",");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="decided" value={decided} />
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.kind} className="py-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" name={r.kind} defaultChecked={r.granted} className="mt-1" />
              <span className="text-sm">
                <span className="block font-medium">{t(`consent.${r.kind}.label`)}</span>
                <span className="block text-fg-muted">{t(`consent.${r.kind}.hint`)}</span>
                <span className="block text-xs text-fg-muted mt-1">{r.decidedAt ? t("decidedAt", { when: r.decidedAt }) : t("undecided")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <SettingsError error={state.error} />
      <Saved show={Boolean(state.ok)} text={t("consentsSaved")} />
      <SubmitButton label={t("saveConsents")} pending={pending} />
    </form>
  );
}

export function DeletionForm({ pendingSince }: { pendingSince: string | null }) {
  const t = useTranslations("appSettings.privacy");
  const [reqState, reqAction, reqPending] = useForm(requestDeletion);
  const [cancelState, cancelAction, cancelPending] = useForm(cancelDeletion);
  if (pendingSince) {
    return (
      <form action={cancelAction} className="space-y-3">
        <p role="status" className="text-sm">{t("deletionPending", { when: pendingSince })}</p>
        <SettingsError error={cancelState.error} />
        <SubmitButton label={t("cancelDeletion")} pending={cancelPending} tone="secondary" />
      </form>
    );
  }
  if (reqState.ok) return <p role="status" className="text-sm">{t("deletionEmailSent")}</p>;
  return (
    <form action={reqAction} className="space-y-3">
      <LocaleField />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="mt-1" />
        <span>{t("deleteConfirm")}</span>
      </label>
      <SettingsError error={reqState.error} />
      <SubmitButton label={t("requestDeletion")} pending={reqPending} tone="danger" />
    </form>
  );
}
