"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputClass, SubmitButton } from "@/components/app/forms";
import { createGoalAction, updateGoalAction, type GoalActionState } from "@/lib/goals/actions";
import { GOAL_PRIORITIES, type Goal } from "@/lib/goals/model";
import { dateYearsFromNow, defaultInflationPct, getTemplate, GOAL_TEMPLATES } from "@/lib/goals/templates";

type MemberOption = { id: string; name: string };

/** Create or edit a goal (section 10). Picking a template pre-fills inflation and the target date. */
export function GoalForm({ members, goal, minDate }: { members: MemberOption[]; goal?: Goal; minDate: string }) {
  const t = useTranslations("appCheckup.goals");
  const te = useTranslations("appCheckup.errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(goal ? updateGoalAction : createGoalAction, {} as GoalActionState);
  const [template, setTemplate] = useState(goal?.template ?? "custom");
  const [inflation, setInflation] = useState(goal ? String(goal.payload.inflationPct) : String(defaultInflationPct("custom")));
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? dateYearsFromNow(getTemplate("custom").horizonYearsHint));
  const [name, setName] = useState(goal?.name ?? "");

  const pickTemplate = (key: string) => {
    setTemplate(key);
    if (goal) return;
    setInflation(String(defaultInflationPct(key)));
    setTargetDate(dateYearsFromNow(getTemplate(key).horizonYearsHint));
    if (!name || GOAL_TEMPLATES.some((x) => t(`template.${x.key}`) === name)) setName(t(`template.${key}`));
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {goal ? <input type="hidden" name="id" value={goal.id} /> : null}

      <Field id="g-template" label={t("fields.template")}>
        <select id="g-template" name="template" value={template} onChange={(e) => pickTemplate(e.target.value)} className={inputClass}>
          {GOAL_TEMPLATES.map((x) => <option key={x.key} value={x.key}>{t(`template.${x.key}`)}</option>)}
        </select>
      </Field>

      <Field id="g-name" label={t("fields.name")}>
        <input id="g-name" name="name" type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      {members.length > 1 ? (
        <Field id="g-member" label={t("fields.member")} hint={t("hints.member")}>
          <select id="g-member" name="memberId" defaultValue={goal?.memberId ?? ""} className={inputClass}>
            <option value="">{t("fields.noMember")}</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="g-targetToday" label={t("fields.targetToday")} hint={t("hints.targetToday")}>
          <input id="g-targetToday" name="targetToday" type="number" inputMode="numeric" min={0} max={1e12} step={1000} required defaultValue={goal?.payload.targetToday ?? ""} className={inputClass} />
        </Field>
        <Field id="g-inflation" label={t("fields.inflationPct")} hint={t("hints.inflationPct")}>
          <input id="g-inflation" name="inflationPct" type="number" inputMode="decimal" min={0} max={30} step={0.5} required value={inflation} onChange={(e) => setInflation(e.target.value)} className={inputClass} />
        </Field>
        <Field id="g-date" label={t("fields.targetDate")}>
          <input id="g-date" name="targetDate" type="date" required min={minDate} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
        </Field>
        <Field id="g-flex" label={t("fields.flexibilityYears")} hint={t("hints.flexibilityYears")}>
          <input id="g-flex" name="flexibilityYears" type="number" inputMode="numeric" min={0} max={10} step={1} defaultValue={goal?.flexibilityYears ?? 0} className={inputClass} />
        </Field>
        <Field id="g-assigned" label={t("fields.assignedAmount")} hint={t("hints.assignedAmount")}>
          <input id="g-assigned" name="assignedAmount" type="number" inputMode="numeric" min={0} max={1e12} step={1000} defaultValue={goal?.payload.assignedAmount ?? 0} className={inputClass} />
        </Field>
        <Field id="g-sip" label={t("fields.monthlySip")} hint={t("hints.monthlySip")}>
          <input id="g-sip" name="monthlySip" type="number" inputMode="numeric" min={0} max={1e12} step={500} defaultValue={goal?.payload.monthlySip ?? 0} className={inputClass} />
        </Field>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-1">{t("fields.priority")}</legend>
        <div className="flex flex-wrap gap-2">
          {GOAL_PRIORITIES.map((p) => (
            <label key={p} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 cursor-pointer has-checked:border-accent has-checked:bg-accent-soft">
              <input type="radio" name="priority" value={p} defaultChecked={(goal?.priority ?? "should") === p} />
              {t(`priority.${p}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <p role="alert" className="text-sm text-danger">{te(state.error as "generic")}</p> : null}
      <SubmitButton label={goal ? t("save") : t("create")} pending={pending} />
    </form>
  );
}
