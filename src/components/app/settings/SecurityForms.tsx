"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { changePassword, removePasskeyAction, renamePasskeyAction, revokeSessionAction, signOutElsewhere } from "@/lib/account/actions";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { Field, LocaleField, SubmitButton, inputClass, useForm } from "../forms";
import { Saved, SettingsError } from "./common";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("appSettings.security");
  const [state, action, pending] = useForm(changePassword);
  if (!hasPassword) return <p className="text-sm text-fg-muted">{t("noPassword")}</p>;
  return (
    <form action={action} className="space-y-4" autoComplete="on">
      <LocaleField />
      <Field id="currentPassword" label={t("currentPassword")}>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field id="newPassword" label={t("newPassword")} hint={t("newPasswordHint", { min: PASSWORD_MIN })}>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} aria-describedby="newPassword-hint" className={inputClass} />
      </Field>
      <SettingsError error={state.error} />
      <Saved show={Boolean(state.ok)} text={t("passwordChanged")} />
      <SubmitButton label={t("changePassword")} pending={pending} />
    </form>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations("appSettings.security");
  const [state, action, pending] = useForm(revokeSessionAction);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" disabled={pending} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-danger-soft disabled:opacity-60">{t("revoke")}</button>
      <SettingsError error={state.error} />
    </form>
  );
}

export function SignOutElsewhereForm({ others }: { others: number }) {
  const t = useTranslations("appSettings.security");
  const [state, action, pending] = useForm(signOutElsewhere);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton label={t("signOutElsewhere")} pending={pending || others === 0} tone="secondary" />
      <SettingsError error={state.error} />
      <Saved show={Boolean(state.ok)} text={t("signedOutElsewhere")} />
    </form>
  );
}

export function PasskeyControls({ passkeyId, name }: { passkeyId: string; name: string }) {
  const t = useTranslations("appSettings.security");
  const [renaming, setRenaming] = useState(false);
  const [renameState, renameAction, renamePending] = useForm(renamePasskeyAction);
  const [removeState, removeAction, removePending] = useForm(removePasskeyAction);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputId = `pk-name-${passkeyId.slice(0, 8)}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {renaming ? (
        <form action={renameAction} className="flex flex-wrap items-end gap-2" onSubmit={() => setRenaming(false)}>
          <input type="hidden" name="passkeyId" value={passkeyId} />
          <label htmlFor={inputId} className="sr-only">{t("passkeyNewName")}</label>
          <input id={inputId} name="name" defaultValue={name} required maxLength={100} className="rounded-lg border border-border bg-bg-elevated px-2 py-1 text-sm" />
          <button type="submit" disabled={renamePending} className="rounded-lg bg-accent px-3 py-1 text-sm text-white hover:bg-accent-strong disabled:opacity-60">{t("save")}</button>
          <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-border px-3 py-1 text-sm">{t("cancel")}</button>
          <SettingsError error={renameState.error} />
        </form>
      ) : (
        <button type="button" onClick={() => setRenaming(true)} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-accent-soft">{t("rename")}</button>
      )}
      {confirmRemove ? (
        <form action={removeAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="passkeyId" value={passkeyId} />
          <span className="text-sm">{t("removeConfirm")}</span>
          <button type="submit" disabled={removePending} className="rounded-lg bg-danger px-3 py-1 text-sm text-white disabled:opacity-60">{t("removeYes")}</button>
          <button type="button" onClick={() => setConfirmRemove(false)} className="rounded-lg border border-border px-3 py-1 text-sm">{t("cancel")}</button>
          <SettingsError error={removeState.error} />
        </form>
      ) : (
        <button type="button" onClick={() => setConfirmRemove(true)} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-danger-soft">{t("remove")}</button>
      )}
    </div>
  );
}
