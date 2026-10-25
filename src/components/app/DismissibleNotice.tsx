"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Notice } from "@/components/ui";

/**
 * A notice the member can hide for the rest of the browser session. The flag
 * lives in sessionStorage so the nudge comes back next visit, which is what an
 * unverified email deserves, but does not sit on every page of one visit.
 */
const listeners = new Set<() => void>();

export function DismissibleNotice({ id, tone, children }: { id: string; tone: "info" | "tip" | "warning"; children: ReactNode }) {
  const t = useTranslations("app.auth");
  const key = `mm.dismissed.${id}`;
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  const read = useCallback(() => {
    try {
      return Boolean(sessionStorage.getItem(key));
    } catch {
      return false;
    }
  }, [key]);
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  if (hidden) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
    listeners.forEach((l) => l());
  };
  return (
    <Notice tone={tone}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button type="button" onClick={dismiss} className="shrink-0 text-xs underline underline-offset-4 text-fg-muted hover:text-fg">{t("dismiss")}</button>
      </div>
    </Notice>
  );
}
