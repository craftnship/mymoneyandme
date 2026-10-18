"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { runCheckUpAction, type CheckUpActionState } from "@/lib/checkup/actions";

/** Runs a new check-up against the household's current data (Server Action). */
export function RunCheckUp({ first = false }: { first?: boolean }) {
  const t = useTranslations("appCheckup.checkup");
  const te = useTranslations("appCheckup.errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(runCheckUpAction, {} as CheckUpActionState);
  return (
    <form action={action} className="flex flex-col gap-2 items-start">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={pending} className="rounded-lg bg-accent text-white px-5 py-2.5 font-medium hover:bg-accent-strong disabled:opacity-60">
        {pending ? t("running") : first ? t("runFirst") : t("run")}
      </button>
      {state.error ? <p role="alert" className="text-sm text-danger">{te(state.error as "generic")}</p> : null}
    </form>
  );
}
