import type { CheckUpResult, DimensionResult } from "./engine";
import type { PlanItem } from "./plan";
import type { DimensionKey } from "../rulepack/schema";

/**
 * Pure helpers around stored check-ups and plans: the "what changed" diff
 * between two runs, plan progress and the approximate score projection.
 */
export type DimensionDelta = {
  key: DimensionKey;
  from: number;
  to: number;
  delta: number;
  statusFrom: DimensionResult["status"];
  statusTo: DimensionResult["status"];
};

export type CheckUpDiff = {
  overall: { from: number; to: number; delta: number };
  grade: { from: string; to: string; changed: boolean };
  confidence: { from: CheckUpResult["confidence"]; to: CheckUpResult["confidence"]; changed: boolean };
  dimensions: DimensionDelta[]; // every dimension, largest movement first
  improved: DimensionKey[];
  worsened: DimensionKey[];
};

/** Compares an earlier result `a` with a later result `b`. */
export function diffCheckUps(a: CheckUpResult, b: CheckUpResult): CheckUpDiff {
  const dimensions: DimensionDelta[] = b.dimensions.map((d) => {
    const prev = a.dimensions.find((x) => x.key === d.key);
    const from = prev?.score ?? 0;
    const statusFrom = prev?.status ?? "unknown";
    // A dimension that was or is unscored has no meaningful movement: 0 → 60 would only mean data was added.
    const comparable = statusFrom !== "unknown" && d.status !== "unknown";
    return { key: d.key, from, to: d.score, delta: comparable ? d.score - from : 0, statusFrom, statusTo: d.status };
  });
  dimensions.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return {
    overall: { from: a.overall, to: b.overall, delta: b.overall - a.overall },
    grade: { from: a.grade, to: b.grade, changed: a.grade !== b.grade },
    confidence: { from: a.confidence, to: b.confidence, changed: a.confidence !== b.confidence },
    dimensions,
    improved: dimensions.filter((d) => d.delta > 0).map((d) => d.key),
    worsened: dimensions.filter((d) => d.delta < 0).map((d) => d.key),
  };
}

/** ISO date `days` from now (default tomorrow), used as the earliest selectable date in forms. */
export function isoDateFromNow(days = 1, now = new Date()): string {
  return new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export const PLAN_STATUSES = ["todo", "inProgress", "done", "skipped", "snoozed"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type PlanItemState = { status: PlanStatus; skipReason: string | null; snoozedUntil: string | null; updatedAt: Date | null };
export type PlanItemWithStatus = PlanItem & PlanItemState;

/** Items still open, in plan order: to do, in progress, or snoozed past their date. */
export function openItems(items: PlanItemWithStatus[], today = new Date().toISOString().slice(0, 10)): PlanItemWithStatus[] {
  return items.filter((i) => i.status === "todo" || i.status === "inProgress" || (i.status === "snoozed" && (!i.snoozedUntil || i.snoozedUntil <= today)));
}

export function planProgress(items: PlanItemWithStatus[]): { done: number; total: number; pct: number } {
  const counted = items.filter((i) => i.status !== "skipped");
  const done = counted.filter((i) => i.status === "done").length;
  return { done, total: counted.length, pct: counted.length ? Math.round((done / counted.length) * 100) : 0 };
}

/**
 * Approximate score if the next `count` open items were done: the current
 * overall plus each item's expected impact, capped at 100. Impacts are
 * estimates from the dimension weights, so the figure is indicative only.
 */
export function projectedScore(overall: number, items: PlanItemWithStatus[], count = 3): { score: number; items: PlanItemWithStatus[] } {
  const next = openItems(items).filter((i) => i.scoreImpact > 0).slice(0, count);
  const gain = next.reduce((s, i) => s + i.scoreImpact, 0);
  return { score: Math.min(100, overall + gain), items: next };
}
