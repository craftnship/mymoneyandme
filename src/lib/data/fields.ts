import type { Family } from "./model";

/**
 * Form field specs for the six data families, matching PAYLOAD_SCHEMAS in
 * model.ts field for field. The generic ItemForm renders these; the Server
 * Action uses the same spec to turn FormData into a typed payload before the
 * zod schema validates it. Client-safe: no server imports.
 */
export type FieldKind = "text" | "amount" | "number" | "percent" | "date" | "select" | "checkbox" | "memberMulti" | "loanSelect";

export type FieldSpec = {
  name: string;
  kind: FieldKind;
  required?: boolean;
  options?: readonly string[]; // select: message keys under appData.options.<name>.<option>
  min?: number;
  max?: number;
  step?: number;
  /** Shown as helper text; message key under appData.hints. */
  hint?: boolean;
};

const label: FieldSpec = { name: "label", kind: "text" };
const frequency: FieldSpec = { name: "frequency", kind: "select", options: ["monthly", "quarterly", "yearly"] };
const nomineeSet: FieldSpec = { name: "nomineeSet", kind: "checkbox" };

export const FIELD_SPECS: Record<Family, readonly FieldSpec[]> = {
  income: [
    label,
    { name: "netMonthly", kind: "amount", required: true, hint: true },
    { name: "grossMonthly", kind: "amount" },
    frequency,
    { name: "growthPct", kind: "percent" },
    { name: "startDate", kind: "date" },
    { name: "endDate", kind: "date" },
    { name: "taxable", kind: "checkbox" },
  ],
  expenses: [
    label,
    { name: "monthly", kind: "amount", required: true },
    { name: "fixed", kind: "checkbox" },
    { name: "essential", kind: "checkbox" },
    { name: "inflationLinked", kind: "checkbox" },
  ],
  assets: [
    label,
    { name: "currentValue", kind: "amount", required: true },
    { name: "purchaseValue", kind: "amount" },
    { name: "purchaseDate", kind: "date" },
    { name: "valuationDate", kind: "date" },
    { name: "liquidity", kind: "select", options: ["liquid", "nearLiquid", "illiquid"], hint: true },
    { name: "linkedLoanId", kind: "loanSelect" },
    nomineeSet,
  ],
  investments: [
    label,
    { name: "currentValue", kind: "amount", required: true },
    { name: "invested", kind: "amount" },
    { name: "units", kind: "number", min: 0, step: 0.001 },
    { name: "sipMonthly", kind: "amount" },
    { name: "sipDate", kind: "number", min: 1, max: 31, step: 1 },
    { name: "assetClass", kind: "select", options: ["equity", "debt", "gold", "realEstate", "other"] },
    { name: "risk", kind: "select", options: ["low", "medium", "high"] },
    { name: "lockInUntil", kind: "date" },
    { name: "retirementTagged", kind: "checkbox", hint: true },
    nomineeSet,
  ],
  loans: [
    label,
    { name: "lenderType", kind: "select", options: ["bank", "nbfc", "employer", "family", "other"] },
    { name: "outstanding", kind: "amount", required: true },
    { name: "principal", kind: "amount" },
    { name: "interestPct", kind: "percent" },
    { name: "rateType", kind: "select", options: ["fixed", "floating"] },
    { name: "emi", kind: "amount" },
    { name: "monthsLeft", kind: "number", min: 0, max: 600, step: 1 },
    { name: "prepaymentPenalty", kind: "checkbox" },
    { name: "insured", kind: "checkbox" },
    { name: "revolving", kind: "checkbox", hint: true },
  ],
  insurance: [
    label,
    { name: "insurerType", kind: "select", options: ["private", "public", "employer"] },
    { name: "sumAssured", kind: "amount", required: true },
    { name: "premium", kind: "amount" },
    frequency,
    { name: "startDate", kind: "date" },
    { name: "endDate", kind: "date" },
    { name: "coveredMemberIds", kind: "memberMulti" },
    { name: "riders", kind: "text" },
    nomineeSet,
  ],
};

/** Payload key that carries the headline amount of each family, and whether it is a monthly flow or a stock. */
export const AMOUNT_KEY: Record<Family, { key: string; monthly: boolean }> = {
  income: { key: "netMonthly", monthly: true },
  expenses: { key: "monthly", monthly: true },
  assets: { key: "currentValue", monthly: false },
  investments: { key: "currentValue", monthly: false },
  loans: { key: "outstanding", monthly: false },
  insurance: { key: "sumAssured", monthly: false },
};

/** Families whose checkbox defaults are true in the schema; an unchecked box must still send false. */
export function checkboxFields(family: Family): string[] {
  return FIELD_SPECS[family].filter((s) => s.kind === "checkbox").map((s) => s.name);
}

export const GENDERS = ["female", "male", "other", "preferNot"] as const;
export const MARITAL = ["single", "married", "divorced", "widowed"] as const;
export const EMPLOYMENT = ["salaried", "selfEmployed", "business", "retired", "student", "homemaker"] as const;
export const RELATIONS = ["spouse", "child", "parent", "other"] as const;
export const CITY_TIERS = [1, 2, 3] as const;

/** Indian states and union territories, stored by English name in users.state. */
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;
