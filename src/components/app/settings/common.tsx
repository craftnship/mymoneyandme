"use client";

import { useTranslations } from "next-intl";

/** Error line for settings forms; keys live under `appSettings.errors`. */
export function SettingsError({ error }: { error?: string }) {
  const t = useTranslations("appSettings.errors");
  if (!error) return null;
  return <p role="alert" className="text-sm text-danger">{t(error as "generic")}</p>;
}

export function Saved({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <p role="status" className="text-sm text-accent-strong">{text}</p>;
}

export const selectClass = "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-base";
