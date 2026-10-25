"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { safeNext } from "@/lib/auth/next";

/** Sign in with a passkey (discoverable credential). Hidden where the browser has no WebAuthn. */
export function PasskeyButton({ next }: { next?: string }) {
  const t = useTranslations("app.auth");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (typeof window !== "undefined" && !browserSupportsWebAuthn()) return null;

  const go = async () => {
    setState("busy");
    try {
      const opt = await fetch("/api/auth/passkey/login/options", { method: "POST" }).then((r) => r.json());
      if (!opt.options) throw new Error(opt.error ?? "failed");
      const response = await startAuthentication({ optionsJSON: opt.options });
      const res = await fetch("/api/auth/passkey/login/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: opt.challengeId, response }) });
      if (!res.ok) throw new Error("failed");
      router.push(safeNext(next, locale) ?? `/${locale}/app`);
      router.refresh();
    } catch {
      setState("error");
    }
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={go} disabled={state === "busy"} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft disabled:opacity-60">{t("usePasskey")}</button>
      {state === "error" ? <span role="alert" className="text-xs text-danger">{t("passkeyFailed")}</span> : null}
    </span>
  );
}

/** Registers a new passkey for the signed-in member (settings page). */
export function AddPasskey() {
  const t = useTranslations("app.auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (typeof window !== "undefined" && !browserSupportsWebAuthn()) return <p className="text-sm text-fg-muted">{t("passkeyUnsupported")}</p>;

  const go = async () => {
    setState("busy");
    try {
      const opt = await fetch("/api/auth/passkey/register/options", { method: "POST" }).then((r) => r.json());
      if (!opt.options) throw new Error(opt.error ?? "failed");
      const response = await startRegistration({ optionsJSON: opt.options });
      const res = await fetch("/api/auth/passkey/register/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: opt.challengeId, response, name }) });
      if (!res.ok) throw new Error("failed");
      setState("done");
      setName("");
      router.refresh();
    } catch {
      setState("error");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="block font-medium mb-1">{t("passkeyName")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={t("passkeyNamePlaceholder")} className="rounded-lg border border-border bg-bg-elevated px-3 py-2" />
      </label>
      <button type="button" onClick={go} disabled={state === "busy"} className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong disabled:opacity-60">{t("addPasskey")}</button>
      {state === "done" ? <span role="status" className="text-sm text-accent-strong">{t("passkeyAdded")}</span> : null}
      {state === "error" ? <span role="alert" className="text-sm text-danger">{t("passkeyFailed")}</span> : null}
    </div>
  );
}
