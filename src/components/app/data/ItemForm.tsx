"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { saveItem, type DataActionState } from "@/lib/data/actions";
import { FIELD_SPECS, type FieldSpec } from "@/lib/data/fields";
import { CONFIDENCE, ITEM_TYPES, type Family } from "@/lib/data/model";
import { AmountInput, DataField, FormLevelError, LocaleInput, Submit, describedBy, inputClass } from "./common";

/**
 * One form for all six families, driven by FIELD_SPECS. Values arrive as the
 * decrypted payload of the item being edited (or nothing for a new one); the
 * Server Action rebuilds the payload from the same spec and validates it.
 */
export type ItemFormValues = { id?: string; type: string; memberId: string | null; confidence: string; payload: Record<string, unknown> };
export type Option = { id: string; name: string };

export function ItemForm({ family, values, members, loans }: { family: Family; values?: ItemFormValues; members: Option[]; loans: Option[] }) {
  const t = useTranslations("appData");
  const [state, action, pending] = useActionState<DataActionState, FormData>(saveItem, {});
  const err = state.fieldErrors ?? {};
  const payload = values?.payload ?? {};
  const str = (name: string) => { const v = payload[name]; return v === undefined || v === null ? "" : String(v); };
  const num = (name: string) => { const v = payload[name]; return typeof v === "number" ? v : undefined; };

  const field = (spec: FieldSpec) => {
    const id = `f-${spec.name}`;
    const label = t(`fields.${spec.name}` as "fields.label");
    const hint = spec.hint ? t(`hints.${spec.name}` as "hints.netMonthly") : undefined;
    const e = err[spec.name];
    const aria = { "aria-invalid": e ? true : undefined, "aria-describedby": describedBy(id, Boolean(hint), Boolean(e)) };
    const optional = !spec.required && spec.kind !== "checkbox" && spec.kind !== "select";
    switch (spec.kind) {
      case "checkbox":
        return (
          <div key={spec.name}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={spec.name} defaultChecked={Boolean(payload[spec.name])} />
              {label}
            </label>
            {hint ? <p className="mt-1 ms-6 text-xs text-fg-muted">{hint}</p> : null}
          </div>
        );
      case "amount":
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e} optional={optional}>
            <AmountInput id={id} name={spec.name} required={spec.required} defaultValue={num(spec.name)} invalid={Boolean(e)} describedBy={aria["aria-describedby"]} />
          </DataField>
        );
      case "number":
      case "percent":
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e} optional={optional}>
            <input id={id} name={spec.name} type="number" inputMode="decimal" min={spec.min ?? 0} max={spec.kind === "percent" ? 100 : spec.max} step={spec.step ?? "any"} required={spec.required} defaultValue={str(spec.name)} {...aria} className={`${inputClass} tabular-nums sm:w-48`} />
          </DataField>
        );
      case "date":
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e} optional={optional}>
            <input id={id} name={spec.name} type="date" required={spec.required} defaultValue={str(spec.name)} {...aria} className={`${inputClass} sm:w-56`} />
          </DataField>
        );
      case "select":
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e}>
            <select id={id} name={spec.name} defaultValue={str(spec.name) || spec.options?.[0]} {...aria} className={inputClass}>
              {spec.options?.map((o) => <option key={o} value={o}>{t(`options.${spec.name}.${o}` as "options.frequency.monthly")}</option>)}
            </select>
          </DataField>
        );
      case "loanSelect":
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e} optional>
            <select id={id} name={spec.name} defaultValue={str(spec.name)} {...aria} className={inputClass}>
              <option value="">{t("items.chooseLoan")}</option>
              {loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </DataField>
        );
      case "memberMulti": {
        const selected = new Set(Array.isArray(payload[spec.name]) ? (payload[spec.name] as string[]) : []);
        return (
          <fieldset key={spec.name}>
            <legend className="block text-sm font-medium mb-1">{label}</legend>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={spec.name} value={m.id} defaultChecked={selected.has(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      }
      default:
        return (
          <DataField key={spec.name} id={id} label={label} hint={hint} error={e} optional={optional}>
            <input id={id} name={spec.name} type="text" maxLength={spec.name === "riders" ? 200 : 80} required={spec.required} defaultValue={str(spec.name)} {...aria} className={inputClass} />
          </DataField>
        );
    }
  };

  return (
    <form action={action} className="space-y-5">
      <LocaleInput />
      <input type="hidden" name="family" value={family} />
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <DataField id="type" label={t("items.type")} error={err.type}>
        <select id="type" name="type" required defaultValue={values?.type ?? ITEM_TYPES[family][0]} aria-invalid={err.type ? true : undefined} className={inputClass}>
          {ITEM_TYPES[family].map((ty) => <option key={ty} value={ty}>{t(`types.${family}.${ty}` as "types.income.salary")}</option>)}
        </select>
      </DataField>
      <div className="grid gap-5 sm:grid-cols-2">
        <DataField id="memberId" label={t("items.member")} error={err.memberId}>
          <select id="memberId" name="memberId" defaultValue={values?.memberId ?? ""} className={inputClass}>
            <option value="">{t("items.household")}</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </DataField>
        <DataField id="confidence" label={t("items.confidence")} error={err.confidence}>
          <select id="confidence" name="confidence" defaultValue={values?.confidence ?? "entered"} className={inputClass}>
            {CONFIDENCE.map((c) => <option key={c} value={c}>{t(`options.confidence.${c}`)}</option>)}
          </select>
        </DataField>
      </div>
      {FIELD_SPECS[family].map(field)}
      <FormLevelError state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit label={t("common.save")} pending={pending} />
        <Link href={`/app/data/${family}`} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("common.cancel")}</Link>
      </div>
    </form>
  );
}
