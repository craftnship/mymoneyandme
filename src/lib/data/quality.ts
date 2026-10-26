import { amountOf } from "./summary";
import type { Family, FinancialItem } from "./model";

/**
 * Data-quality checks (section 8 and the companion spec's "data quality"
 * assessment): stale valuations, likely duplicates, amounts of zero, loans
 * without an EMI and policies or incomes that have ended. Pure over decrypted
 * items so the data overview, the check-up and tests share one list. Each
 * issue names the items behind it so the page can link to them.
 */
export type QualityIssue =
  | { kind: "stale"; family: Family; id: string; label: string; months: number }
  | { kind: "duplicate"; family: Family; ids: string[]; label: string; amount: number }
  | { kind: "zero"; family: Family; id: string; label: string }
  | { kind: "loanNoEmi"; family: "loans"; id: string; label: string }
  | { kind: "ended"; family: Family; id: string; label: string; endDate: string };

export const STALE_AFTER_MONTHS = 12;
const DUPLICATE_SEVERITY: Record<QualityIssue["kind"], number> = { zero: 0, loanNoEmi: 1, ended: 2, duplicate: 3, stale: 4 };
/** Loan types that have no fixed instalment, so a missing EMI is normal. */
const NO_EMI_LOAN_TYPES = new Set(["creditCard", "family", "bnpl"]);

/** Loosely typed on purpose: the checks read a few payload keys and the tests build items by hand. */
type ItemLike = Pick<FinancialItem, "id" | "family" | "type" | "memberId" | "updatedAt"> & { payload: unknown };

function labelOf(item: ItemLike): string {
  const p = item.payload as Record<string, unknown>;
  return typeof p.label === "string" ? p.label.trim() : "";
}

function monthsSince(date: Date | string | undefined, now: Date): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  if (Number.isNaN(d.getTime())) return null;
  return (now.getTime() - d.getTime()) / (30.44 * 24 * 3600 * 1000);
}

export function dataQuality(items: ItemLike[], now = new Date()): QualityIssue[] {
  const out: QualityIssue[] = [];
  const today = now.toISOString().slice(0, 10);

  for (const item of items) {
    const p = item.payload as Record<string, unknown>;
    const label = labelOf(item);

    // Amount of zero: either a placeholder or a figure the member did not know. Either way it reads as "nothing" in the score.
    if (amountOf(item) === 0 && (item.family !== "loans" || p.outstanding === 0)) out.push({ kind: "zero", family: item.family, id: item.id, label });

    // Stocks (assets, investments) go stale; flows are re-entered when they change.
    if (item.family === "assets" || item.family === "investments") {
      const valuation = typeof p.valuationDate === "string" && p.valuationDate ? p.valuationDate : undefined;
      const age = monthsSince(valuation, now) ?? monthsSince(item.updatedAt, now);
      if (age !== null && age >= STALE_AFTER_MONTHS) out.push({ kind: "stale", family: item.family, id: item.id, label, months: Math.floor(age) });
    }

    if (item.family === "loans" && !NO_EMI_LOAN_TYPES.has(item.type) && amountOf(item) > 0 && !(typeof p.emi === "number" && p.emi > 0)) {
      out.push({ kind: "loanNoEmi", family: "loans", id: item.id, label });
    }

    if ((item.family === "insurance" || item.family === "income") && typeof p.endDate === "string" && p.endDate && p.endDate < today) {
      out.push({ kind: "ended", family: item.family, id: item.id, label, endDate: p.endDate });
    }
  }

  // Likely duplicates: same family, type, member and amount, and the same (or no) label.
  const groups = new Map<string, ItemLike[]>();
  for (const item of items) {
    const key = [item.family, item.type, item.memberId ?? "", amountOf(item), labelOf(item).toLowerCase()].join("|");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const group of groups.values()) {
    if (group.length < 2 || amountOf(group[0]) === 0) continue;
    out.push({ kind: "duplicate", family: group[0].family, ids: group.map((i) => i.id), label: labelOf(group[0]), amount: amountOf(group[0]) });
  }

  return out.sort((a, b) => DUPLICATE_SEVERITY[a.kind] - DUPLICATE_SEVERITY[b.kind]);
}

/** Where to fix an issue: the item's edit page, or the family list for a duplicate pair. */
export function qualityHref(issue: QualityIssue): string {
  return issue.kind === "duplicate" ? `/app/data/${issue.family}` : `/app/data/${issue.family}/${issue.id}`;
}
