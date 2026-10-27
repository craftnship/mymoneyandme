import { runCheckUp } from "../checkup/engine";
import { buildSnapshot, type SnapshotUser } from "../data/snapshot";
import { completeness } from "../data/completeness";
import { HIGH_COST_RATE_PCT, type Family, type FinancialItem } from "../data/model";
import type { Member } from "../data/store";
import type { Goal } from "../goals/model";
import { projectGoal } from "../goals/math";

/**
 * Money snapshot (companion spec sections 7 and 13): the handful of numbers a
 * member checks each month, computed from the same household snapshot the
 * check-up scores so the dashboard, the check-up and the plan never disagree.
 * Pure over decrypted records; the store keeps one row per household and month.
 */
export type IndicatorKey = "emergency" | "cashflow" | "debt" | "goals" | "retirement" | "data";
export const INDICATOR_KEYS: IndicatorKey[] = ["emergency", "cashflow", "debt", "goals", "retirement", "data"];
export type IndicatorStatus = "good" | "watch" | "act" | "unknown";
export type Indicator = { key: IndicatorKey; value: number; kind: "months" | "percent" | "ratio" | "count"; status: IndicatorStatus; projected?: boolean };

export type MoneySnapshot = {
  month: string; // YYYY-MM
  computedAt: string;
  dataAsOf?: string;
  rulePackVersion: string;
  takeHome: number;
  essentialSpend: number;
  discretionarySpend: number;
  emis: number;
  surplus: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  liquidNetWorth: number;
  emergencyMonths: number;
  score: number;
  indicators: Indicator[];
  goals: { total: number; onTrack: number };
  completeness: number;
};

export type SnapshotInputUser = SnapshotUser & Parameters<typeof completeness>[0];

export function monthOf(d: Date): string {
  return d.toISOString().slice(0, 7);
}

const DATA_GOOD = 80;
const DATA_WATCH = 50;

export function computeMoneySnapshot(user: SnapshotInputUser, members: Member[], items: FinancialItem[], goals: Goal[], now = new Date()): MoneySnapshot {
  const h = buildSnapshot(user, members, items, goals, now);
  const result = runCheckUp(h);
  const m = result.metrics;
  const dim = (key: string) => result.dimensions.find((d) => d.key === key);
  const inv = h.investments;
  const essential = (h.monthlyEssentialExpenses ?? h.monthlyExpenses * 0.6) - h.monthlyEmi;
  const essentialSpend = Math.max(0, essential);
  const discretionarySpend = Math.max(0, h.monthlyExpenses - h.monthlyEmi - essentialSpend);
  const assets = h.liquidAssets + inv.equity + inv.debt + inv.gold + inv.realEstate + (inv.other ?? 0) + h.retirementCorpus;
  const projected = goals.map((g) => projectGoal({ ...g.payload, targetDate: g.targetDate }, now));
  const onTrack = projected.filter((p) => p.onTrack).length;
  const c = completeness(user, members, items).percent;
  const { liquidNetWorth } = netWorthBreakdown(items, now);

  const indicators: Indicator[] = [
    { key: "emergency", value: m.emergencyMonths, kind: "months", status: dim("emergency")?.status ?? "unknown" },
    { key: "cashflow", value: m.savingsRate, kind: "percent", status: dim("cashflow")?.status ?? "unknown" },
    { key: "debt", value: m.emiToIncome, kind: "percent", status: dim("debt")?.status ?? "unknown" },
    { key: "goals", value: goals.length ? onTrack / goals.length : 0, kind: "percent", status: goals.length ? dim("goals")?.status ?? "unknown" : "unknown" },
    // Retirement readiness is a projection (corpus at retirement against the corpus needed), not a figure that exists today.
    { key: "retirement", value: m.retirementReadiness, kind: "ratio", status: dim("retirement")?.status ?? "unknown", projected: true },
    { key: "data", value: c / 100, kind: "percent", status: c >= DATA_GOOD ? "good" : c >= DATA_WATCH ? "watch" : "act" },
  ];

  return {
    month: monthOf(now),
    computedAt: now.toISOString(),
    dataAsOf: h.dataAsOf,
    rulePackVersion: result.rulePackVersion,
    takeHome: Math.round(h.monthlyIncome),
    essentialSpend: Math.round(essentialSpend),
    discretionarySpend: Math.round(discretionarySpend),
    emis: Math.round(h.monthlyEmi),
    surplus: Math.round(h.monthlyIncome - h.monthlyExpenses),
    assets: Math.round(assets),
    liabilities: Math.round(h.totalDebt),
    netWorth: Math.round(assets - h.totalDebt),
    liquidNetWorth: Math.round(liquidNetWorth),
    emergencyMonths: Math.round(m.emergencyMonths * 10) / 10,
    score: result.overall,
    indicators,
    goals: { total: goals.length, onTrack },
    completeness: c,
  };
}

/** The strip figures and which data family each one comes from, for "see the records" links. */
export const STRIP_FIELDS: { key: keyof MoneySnapshot; family: Family | "netWorth"; monthly: boolean }[] = [
  { key: "takeHome", family: "income", monthly: true },
  { key: "essentialSpend", family: "expenses", monthly: true },
  { key: "discretionarySpend", family: "expenses", monthly: true },
  { key: "emis", family: "loans", monthly: true },
  { key: "surplus", family: "expenses", monthly: true },
  { key: "assets", family: "netWorth", monthly: false },
  { key: "liabilities", family: "loans", monthly: false },
  { key: "netWorth", family: "netWorth", monthly: false },
  { key: "liquidNetWorth", family: "netWorth", monthly: false },
];

export type SnapshotDelta = { key: keyof MoneySnapshot; from: number; to: number; change: number };

/** What moved between two months, largest absolute change first; unchanged figures are left out. */
export function snapshotDelta(current: MoneySnapshot, previous: MoneySnapshot): SnapshotDelta[] {
  const out: SnapshotDelta[] = [];
  for (const f of [...STRIP_FIELDS.map((s) => s.key), "emergencyMonths" as const, "score" as const]) {
    const from = previous[f];
    const to = current[f];
    if (typeof from !== "number" || typeof to !== "number" || from === to) continue;
    out.push({ key: f, from, to, change: to - from });
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/**
 * Net worth view (spec section 13). Categories follow how the money behaves,
 * not the form it was entered on: a gold ETF sits with jewellery, EPF with NPS.
 */
export type AssetCategory = "cash" | "equity" | "debt" | "gold" | "realEstate" | "retirement" | "business" | "vehicle" | "other";
export const ASSET_CATEGORIES: AssetCategory[] = ["cash", "equity", "debt", "gold", "realEstate", "retirement", "business", "vehicle", "other"];

export type NetWorthItem = { id: string; family: "assets" | "investments"; type: string; label: string; value: number; liquid: boolean; category: AssetCategory; valuationDate?: string };
export type CategoryTotal = { category: AssetCategory; total: number; share: number; liquid: number; items: NetWorthItem[] };
export type LiabilityItem = { id: string; type: string; label: string; outstanding: number; emi: number; interestPct?: number; monthsLeft?: number; highCost: boolean; shortTerm: boolean };
export type Concentration = { kind: "category"; category: AssetCategory; share: number } | { kind: "item"; item: NetWorthItem; share: number };

export type NetWorthBreakdown = {
  assets: number;
  liquidAssets: number;
  illiquidAssets: number;
  categories: CategoryTotal[]; // non-empty categories, largest first
  liabilities: number;
  shortTermLiabilities: number;
  loans: LiabilityItem[]; // largest outstanding first
  netWorth: number;
  liquidNetWorth: number;
  concentration: Concentration[];
};

/** A category or a single holding above these shares of total assets is flagged. The self-occupied home is exempt: it is not an investment choice. */
export const CONCENTRATION_CATEGORY_SHARE = 0.6;
export const CONCENTRATION_ITEM_SHARE = 0.4;
/** Loans due inside this many months count against liquid net worth. */
export const SHORT_TERM_MONTHS = 12;

/** Asset types that are never cash, whatever liquidity was entered: a house takes months to sell and retirement accounts are locked. */
const NEVER_LIQUID_ASSET_TYPES = new Set(["realEstateSelf", "realEstateLetOut", "land", "vehicle", "businessEquity", "epf", "ppf", "nps"]);
const NEVER_LIQUID_INVESTMENT_TYPES = new Set(["ulip", "insuranceSavings", "alternative"]);
const NO_EMI_LOAN_TYPES = new Set(["creditCard", "bnpl"]);

function categoryOfAsset(type: string): AssetCategory {
  if (type === "cash" || type === "fixedDeposit" || type === "receivable") return "cash";
  if (type === "gold") return "gold";
  if (type === "realEstateSelf" || type === "realEstateLetOut" || type === "land") return "realEstate";
  if (type === "epf" || type === "ppf" || type === "nps") return "retirement";
  if (type === "businessEquity") return "business";
  if (type === "employeeStock") return "equity";
  if (type === "vehicle") return "vehicle";
  return "other";
}

function categoryOfInvestment(p: { assetClass: string; retirementTagged: boolean }): AssetCategory {
  if (p.retirementTagged) return "retirement";
  switch (p.assetClass) {
    case "equity": return "equity";
    case "debt": return "debt";
    case "gold": return "gold";
    case "realEstate": return "realEstate";
    default: return "other";
  }
}

function isLockedIn(lockInUntil: string | undefined, now: Date): boolean {
  return Boolean(lockInUntil) && new Date(`${lockInUntil}T00:00:00Z`).getTime() > now.getTime();
}

export function netWorthBreakdown(items: FinancialItem[], now = new Date()): NetWorthBreakdown {
  const holdings: NetWorthItem[] = [];
  for (const i of items) {
    if (i.family === "assets") {
      const p = i.payload as FinancialItem<"assets">["payload"];
      const liquid = !NEVER_LIQUID_ASSET_TYPES.has(i.type) && p.liquidity !== "illiquid";
      holdings.push({ id: i.id, family: "assets", type: i.type, label: p.label, value: p.currentValue, liquid, category: categoryOfAsset(i.type), valuationDate: p.valuationDate });
    } else if (i.family === "investments") {
      const p = i.payload as FinancialItem<"investments">["payload"];
      const liquid = !NEVER_LIQUID_INVESTMENT_TYPES.has(i.type) && !p.retirementTagged && !isLockedIn(p.lockInUntil, now);
      holdings.push({ id: i.id, family: "investments", type: i.type, label: p.label, value: p.currentValue, liquid, category: categoryOfInvestment(p) });
    }
  }
  const assets = holdings.reduce((s, h) => s + h.value, 0);
  const liquidAssets = holdings.filter((h) => h.liquid).reduce((s, h) => s + h.value, 0);
  const categories: CategoryTotal[] = ASSET_CATEGORIES.map((category) => {
    const own = holdings.filter((h) => h.category === category).sort((a, b) => b.value - a.value);
    const total = own.reduce((s, h) => s + h.value, 0);
    return { category, total, share: assets > 0 ? total / assets : 0, liquid: own.filter((h) => h.liquid).reduce((s, h) => s + h.value, 0), items: own };
  }).filter((c) => c.items.length).sort((a, b) => b.total - a.total);

  const loans: LiabilityItem[] = items
    .filter((i): i is FinancialItem<"loans"> => i.family === "loans")
    .map((l) => {
      const p = l.payload;
      const highCost = (p.interestPct ?? 0) > HIGH_COST_RATE_PCT || (l.type === "creditCard" && p.revolving);
      const shortTerm = NO_EMI_LOAN_TYPES.has(l.type) || (p.monthsLeft !== undefined && p.monthsLeft <= SHORT_TERM_MONTHS);
      return { id: l.id, type: l.type, label: p.label, outstanding: p.outstanding, emi: p.emi, interestPct: p.interestPct, monthsLeft: p.monthsLeft, highCost, shortTerm };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
  const liabilities = loans.reduce((s, l) => s + l.outstanding, 0);
  const shortTermLiabilities = loans.filter((l) => l.shortTerm).reduce((s, l) => s + l.outstanding, 0);

  const concentration: Concentration[] = [];
  if (assets > 0) {
    for (const c of categories) if (c.share >= CONCENTRATION_CATEGORY_SHARE && c.category !== "cash") concentration.push({ kind: "category", category: c.category, share: c.share });
    for (const h of holdings) {
      const share = h.value / assets;
      if (share >= CONCENTRATION_ITEM_SHARE && h.type !== "realEstateSelf" && h.category !== "cash") concentration.push({ kind: "item", item: h, share });
    }
  }

  return {
    assets,
    liquidAssets,
    illiquidAssets: assets - liquidAssets,
    categories,
    liabilities,
    shortTermLiabilities,
    loans,
    netWorth: assets - liabilities,
    liquidNetWorth: liquidAssets - shortTermLiabilities,
    concentration,
  };
}
