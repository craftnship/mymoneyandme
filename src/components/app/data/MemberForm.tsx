"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { saveMember, type DataActionState } from "@/lib/data/actions";
import { RELATIONS } from "@/lib/data/fields";
import { DataField, FormLevelError, LocaleInput, Submit, describedBy, inputClass } from "./common";

export type MemberDefaults = { id?: string; name: string; relation: string; dob: string | null; earns: boolean; dependant: boolean };

export function MemberForm({ defaults }: { defaults: MemberDefaults }) {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(saveMember, {});
  const err = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-5">
      <LocaleInput />
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <DataField id="name" label={t("members.name")} error={err.name}>
        <input id="name" name="name" type="text" required maxLength={100} defaultValue={defaults.name} aria-invalid={Boolean(err.name) || undefined} aria-describedby={describedBy("name", false, Boolean(err.name))} className={inputClass} />
      </DataField>
      <DataField id="relation" label={t("members.relation")} error={err.relation}>
        <select id="relation" name="relation" required defaultValue={defaults.relation} className={inputClass}>
          {RELATIONS.map((r) => <option key={r} value={r}>{t(`options.relation.${r}`)}</option>)}
        </select>
      </DataField>
      <DataField id="dob" label={t("members.dob")} optional error={err.dob}>
        <input id="dob" name="dob" type="date" max={today} defaultValue={defaults.dob ?? ""} aria-invalid={Boolean(err.dob) || undefined} aria-describedby={describedBy("dob", false, Boolean(err.dob))} className={inputClass} />
      </DataField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="earns" defaultChecked={defaults.earns} />
        {t("members.earns")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="dependant" defaultChecked={defaults.dependant} />
        {t("members.dependant")}
      </label>
      <FormLevelError state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit label={t("common.save")} pending={pending} />
        <Link href="/app/data/members" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("common.cancel")}</Link>
      </div>
    </form>
  );
}
