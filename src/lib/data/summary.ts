import { AMOUNT_KEY } from "./fields";
import { FAMILIES, type Family } from "./model";

/**
 * Totals per family for the data overview, and the soft data-quality warnings
 * of section 8. Pure functions over decrypted items.
 */
export type FamilyTotal = { family: Family; count: number; total: number; monthly: boolean };

export type ItemLike = { family: Family; type: string; payload: unknown };

export function amountOf(item: Pick<ItemLike, "family" | "payload">): number {
  const v = (item.payload as Record<string, unknown>)[AMOUNT_KEY[item.family].key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function familyTotals(items: Pick<ItemLike, "family" | "payload">[]): FamilyTotal[] {
  return FAMILIES.map((family) => {
    const own = items.filter((i) => i.family === family);
    return { family, count: own.length, total: own.reduce((s, i) => s + amountOf(i), 0), monthly: AMOUNT_KEY[family].monthly };
  });
}

export type SoftWarning =
  | { kind: "expensesOverIncome"; income: number; expenses: number }
  | { kind: "emiOverExpenses"; emi: number; expenses: number }
  | { kind: "lowLifeCover"; cover: number; target: number };

const LIFE_TYPES = new Set(["termLife", "endowment"]);

export function softWarnings(items: ItemLike[]): SoftWarning[] {
  const sum = (family: Family, pick: (p: Record<string, unknown>) => unknown, filter?: (i: Pick<ItemLike, "type">) => boolean) =>
    items.filter((i) => i.family === family && (!filter || filter(i))).reduce((s, i) => {
      const v = pick(i.payload as Record<string, unknown>);
      return s + (typeof v === "number" && Number.isFinite(v) ? v : 0);
    }, 0);

  const income = sum("income", (p) => p.netMonthly);
  const expenses = sum("expenses", (p) => p.monthly);
  const emi = sum("loans", (p) => p.emi);
  const lifeCover = sum("insurance", (p) => p.sumAssured, (i) => LIFE_TYPES.has(i.type));
  const hasLife = items.some((i) => i.family === "insurance" && LIFE_TYPES.has(i.type));

  const out: SoftWarning[] = [];
  if (income > 0 && expenses > income) out.push({ kind: "expensesOverIncome", income, expenses });
  // EMIs are part of monthly outgo, so they can never exceed the expenses recorded.
  if (emi > 0 && expenses > 0 && emi > expenses) out.push({ kind: "emiOverExpenses", emi, expenses });
  // Section 8: sum assured far below income. Target is 10x annual take-home; "far" is under half of that.
  const target = income * 12 * 10;
  if (hasLife && income > 0 && lifeCover < target / 2) out.push({ kind: "lowLifeCover", cover: lifeCover, target });
  return out;
}
