import india2025 from "../../../rulepacks/india-2025-26.v1.json";
import india2026 from "../../../rulepacks/india-2026-27.v1.json";
import { rulePackSchema, type RulePack, type RuleSource } from "./schema";

// Every pack is validated once at module load so a malformed edit fails the
// build instead of producing a silently wrong score. Older packs stay
// registered: a stored check-up is re-read with the version that scored it.
const PACKS: Record<string, RulePack> = {
  [india2025.version]: rulePackSchema.parse(india2025),
  [india2026.version]: rulePackSchema.parse(india2026),
};

export const CURRENT_RULEPACK_VERSION = india2026.version;
export const RULEPACK_VERSIONS = Object.keys(PACKS);

export function getRulePack(version: string = CURRENT_RULEPACK_VERSION): RulePack {
  const pack = PACKS[version];
  if (!pack) throw new Error(`Unknown rule pack version: ${version}`);
  return pack;
}

/**
 * The source behind a figure, looked up by its dotted path and then by each
 * parent path, so `schemes.ppf.rate` falls back to the `schemes.ppf` entry.
 */
export function sourceFor(path: string, pack: RulePack = getRulePack()): RuleSource | undefined {
  const parts = path.split(".");
  for (let n = parts.length; n > 0; n--) {
    const s = pack.sources?.[parts.slice(0, n).join(".")];
    if (s) return s;
  }
  return undefined;
}

/**
 * Resolves {placeholders} in content against the rule pack (section 12), so
 * "{section80C}" or "{ppfRate}" stay current after a Budget change without
 * re-editing articles. Unknown keys are left untouched so authors can see them.
 */
export function resolvePlaceholders(text: string, pack: RulePack = getRulePack()): string {
  const values: Record<string, string> = {
    inflation_default: pct(pack.assumptions.inflationGeneral),
    inflation_education: pct(pack.assumptions.inflationEducation),
    return_equity: pct(pack.assumptions.returnEquity),
    return_debt: pct(pack.assumptions.returnDebt),
    section_80c_limit: inr(pack.tax.oldRegime.deductionLimits.section80C),
    section_80d_self: inr(pack.tax.oldRegime.deductionLimits.section80D_self),
    nps_80ccd1b_limit: inr(pack.tax.oldRegime.deductionLimits.section80CCD1B),
    standard_deduction_new: inr(pack.tax.newRegime.standardDeduction),
    standard_deduction_old: inr(pack.tax.oldRegime.standardDeduction),
    rebate_87a_limit_new: inr(pack.tax.newRegime.rebate87A.incomeLimit),
    ppf_rate: pct(pack.schemes.ppf.rate as number),
    epf_rate: pct(pack.schemes.epf.rate as number),
    ssy_rate: pct(pack.schemes.ssy.rate as number),
    scss_rate: pct(pack.schemes.scss.rate as number),
    nsc_rate: pct(pack.schemes.nsc.rate as number),
    financial_year: pack.financialYear,
    rulepack_version: pack.version,
  };
  return text.replace(/\{([a-z0-9_]+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

function pct(n: number) {
  return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2).replace(/\.?0+$/, "")}%`;
}

function inr(n: number) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}
