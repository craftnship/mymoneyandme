import { CALCULATORS, CALCULATOR_GROUPS } from "./definitions";
import { FORMULAS } from "./formulas";
import type { CalculatorDef, FormulaResult, InputDef } from "./types";
import { CURRENT_RULEPACK_VERSION, getRulePack } from "../rulepack";

export { CALCULATORS, CALCULATOR_GROUPS };
export type { CalculatorDef, FormulaResult, InputDef };

const bySlug = new Map(CALCULATORS.map((c) => [c.slug, c]));

export function getCalculator(slug: string): CalculatorDef | undefined {
  return bySlug.get(slug);
}

function readPath(obj: unknown, path: string): number {
  const v = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
  if (typeof v !== "number") throw new Error(`Rule pack path ${path} is not a number`);
  return v;
}

/** Defaults with rule-pack references resolved against the given pack version. */
export function resolveDefaults(def: CalculatorDef, version = CURRENT_RULEPACK_VERSION): Record<string, number> {
  const pack = getRulePack(version);
  const out: Record<string, number> = {};
  for (const input of def.inputs) {
    out[input.key] = typeof input.default === "number" ? input.default : readPath(pack, input.default.ref);
  }
  return out;
}

export type CalculationRecord = FormulaResult & {
  slug: string;
  inputs: Record<string, number>;
  rulePackVersion: string;
  computedAt?: string; // set by the API when a result is stored
};

/**
 * Runs a calculator. The result records the rule-pack version so a saved
 * scenario stays reproducible after parameters change (section 6).
 */
export function runCalculator(
  slug: string,
  inputs: Partial<Record<string, number>> = {},
  version = CURRENT_RULEPACK_VERSION,
): CalculationRecord {
  const def = getCalculator(slug);
  if (!def) throw new Error(`Unknown calculator: ${slug}`);
  const formula = FORMULAS[def.formula];
  if (!formula) throw new Error(`Unknown formula family: ${def.formula}`);
  const merged = { ...resolveDefaults(def, version) };
  for (const input of def.inputs) {
    const v = inputs[input.key];
    if (typeof v === "number" && Number.isFinite(v)) {
      const lo = input.min ?? -Infinity;
      const hi = input.max ?? Infinity;
      merged[input.key] = Math.min(hi, Math.max(lo, v));
    }
  }
  const pack = getRulePack(version);
  const result = formula(merged, { rulePackVersion: version, assumptions: pack.assumptions });
  return { ...result, slug, inputs: merged, rulePackVersion: version };
}

/** Encodes inputs into a shareable query string (section 6: shareable URL). */
export function encodeInputs(inputs: Record<string, number>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(inputs)) p.set(k, String(v));
  return p.toString();
}

export function decodeInputs(def: CalculatorDef, params: URLSearchParams | Record<string, string | string[] | undefined>): Record<string, number> {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : (Array.isArray(params[k]) ? params[k]?.[0] : params[k]));
  const out: Record<string, number> = {};
  for (const input of def.inputs) {
    const raw = get(input.key);
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[input.key] = n;
  }
  return out;
}
