import type { EmploymentType, HouseholdSnapshot } from "../checkup/engine";
import { HIGH_COST_RATE_PCT, type FinancialItem, type Payload } from "./model";
import type { Member } from "./store";
import type { Goal } from "../goals/model";
import { monthsBetween } from "../goals/math";

/**
 * Turns the captured household data into the engine's HouseholdSnapshot.
 * Pure and synchronous so it is unit-testable and so a stored check-up can
 * record exactly which inputs produced it.
 *
 * Simplifications, in one place so they can be reviewed:
 * - Expense EMIs count as essential: a loan instalment is not discretionary.
 * - Liquid assets are cash, deposits and receivables marked liquid or
 *   near-liquid, plus low-risk debt investments with no lock-in; those debt
 *   investments are then left out of `investments.debt` so nothing is counted
 *   twice.
 * - Retirement-tagged investments go into `retirementCorpus` (with EPF, PPF and
 *   NPS) and not into the asset-class split, again to avoid double counting.
 * - Health cover per member is the larger of the best floater that covers them
 *   and their best individual or employer policy; the household figure is the
 *   least-covered member, because every member needs cover. A policy with an
 *   empty covered-member list is taken to cover the whole household.
 * - Life cover is the sum of term and endowment sums assured across earners.
 * - A will is not captured yet, so `willInPlace` is left undefined; the engine
 *   then relies on its age-and-dependants rule.
 * - A quick-start "no" to term or health cover, with no policy of that kind
 *   entered, counts as known cover of zero; "yes" or "not sure" without a
 *   policy leaves the cover unknown until the policy is added.
 */
export type SnapshotUser = {
  dob: string | null;
  employment: EmploymentType;
  dependants: number;
  cityTier: 1 | 2 | 3;
  retirementAge: number | null;
  hasTermCover?: boolean | null;
  hasHealthCover?: boolean | null;
};

/** Snapshot fields in the order that most improves confidence when added. */
export const SNAPSHOT_FIELDS = [
  "monthlyIncome",
  "monthlyExpenses",
  "liquidAssets",
  "lifeCover",
  "healthCover",
  "monthlyEmi",
  "investments",
  "retirementCorpus",
  "age",
  "goals",
  "nominationsSet",
  "dependants",
  "retirementAge",
  "monthlyRetirementSip",
  "employment",
  "cityTier",
] as const;
export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

const DEFAULT_AGE = 35;
const LIQUID_ASSET_TYPES = new Set(["cash", "fixedDeposit", "receivable"]);
const REAL_ESTATE_TYPES = new Set(["realEstateSelf", "realEstateLetOut", "land"]);
const RETIREMENT_ASSET_TYPES = new Set(["epf", "ppf", "nps"]);
const LIFE_TYPES = new Set(["termLife", "endowment"]);
const HEALTH_FLOATER_TYPES = new Set(["healthFloater"]);
const HEALTH_INDIVIDUAL_TYPES = new Set(["healthIndividual", "healthEmployer"]);

export function ageFromDob(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function perMonth(amount: number, frequency: "monthly" | "quarterly" | "yearly"): number {
  return frequency === "yearly" ? amount / 12 : frequency === "quarterly" ? amount / 3 : amount;
}

function isLockedIn(lockInUntil: string | undefined, now: Date): boolean {
  return Boolean(lockInUntil) && new Date(`${lockInUntil}T00:00:00Z`).getTime() > now.getTime();
}

export function buildSnapshot(user: SnapshotUser, members: Member[], items: FinancialItem[], goals: Goal[], now = new Date()): HouseholdSnapshot {
  const provided = new Set<SnapshotField>();
  const by = <F extends FinancialItem["family"]>(family: F) => items.filter((i): i is FinancialItem<F> => i.family === family);

  const age = ageFromDob(user.dob, now);
  if (age !== null) provided.add("age");
  provided.add("employment");
  provided.add("cityTier");
  if (user.retirementAge) provided.add("retirementAge");

  const activeMembers = members;
  const earners = activeMembers.filter((m) => m.earns).length;
  const dependantsFromMembers = activeMembers.filter((m) => m.dependant).length;
  const dependants = activeMembers.length > 1 ? dependantsFromMembers : user.dependants;
  if (activeMembers.length > 1 || user.dependants > 0) provided.add("dependants");

  // Income
  const incomes = by("income");
  const monthlyIncome = incomes.reduce((s, i) => s + perMonth(i.payload.netMonthly, i.payload.frequency), 0);
  if (incomes.length) provided.add("monthlyIncome");

  // Expenses and loans
  const expenses = by("expenses");
  const loans = by("loans");
  const monthlyEmi = loans.reduce((s, l) => s + l.payload.emi, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.payload.monthly, 0);
  const essentialTotal = expenses.filter((e) => e.payload.essential).reduce((s, e) => s + e.payload.monthly, 0);
  const monthlyExpenses = expenseTotal + monthlyEmi;
  const monthlyEssentialExpenses = expenses.length ? essentialTotal + monthlyEmi : undefined;
  if (expenses.length) provided.add("monthlyExpenses");
  const totalDebt = loans.reduce((s, l) => s + l.payload.outstanding, 0);
  const highCostDebt = loans
    .filter((l) => (l.payload.interestPct ?? 0) > HIGH_COST_RATE_PCT || (l.type === "creditCard" && l.payload.revolving))
    .reduce((s, l) => s + l.payload.outstanding, 0);
  if (loans.length) provided.add("monthlyEmi");

  // Assets
  const assets = by("assets");
  let liquidAssets = 0;
  let retirementCorpus = 0;
  const investments = { equity: 0, debt: 0, gold: 0, realEstate: 0, other: 0 };
  let anyInvestment = false;
  for (const a of assets) {
    const v = a.payload.currentValue;
    if (RETIREMENT_ASSET_TYPES.has(a.type)) retirementCorpus += v;
    else if (LIQUID_ASSET_TYPES.has(a.type) && a.payload.liquidity !== "illiquid") liquidAssets += v;
    else if (REAL_ESTATE_TYPES.has(a.type)) { investments.realEstate += v; anyInvestment = true; }
    else if (a.type === "gold") { investments.gold += v; anyInvestment = true; }
    else { investments.other += v; anyInvestment = true; }
  }
  if (assets.some((a) => LIQUID_ASSET_TYPES.has(a.type))) provided.add("liquidAssets");
  if (assets.some((a) => RETIREMENT_ASSET_TYPES.has(a.type))) provided.add("retirementCorpus");

  // Investments
  const invs = by("investments");
  let monthlyRetirementSip = 0;
  for (const i of invs) {
    const p = i.payload;
    if (p.retirementTagged) {
      retirementCorpus += p.currentValue;
      monthlyRetirementSip += p.sipMonthly;
      provided.add("retirementCorpus");
      if (p.sipMonthly > 0) provided.add("monthlyRetirementSip");
      continue;
    }
    anyInvestment = true;
    if (p.assetClass === "debt" && p.risk === "low" && !isLockedIn(p.lockInUntil, now)) {
      liquidAssets += p.currentValue;
      provided.add("liquidAssets");
      continue;
    }
    investments[p.assetClass] += p.currentValue;
  }
  if (anyInvestment) provided.add("investments");

  // Insurance
  const policies = by("insurance");
  const lifeCover = policies.filter((p) => LIFE_TYPES.has(p.type)).reduce((s, p) => s + p.payload.sumAssured, 0);
  if (policies.some((p) => LIFE_TYPES.has(p.type)) || user.hasTermCover === false) provided.add("lifeCover");
  const healthCover = healthCoverPerHousehold(policies, activeMembers);
  if (policies.some((p) => HEALTH_FLOATER_TYPES.has(p.type) || HEALTH_INDIVIDUAL_TYPES.has(p.type)) || user.hasHealthCover === false) provided.add("healthCover");

  // Nominations: known only when at least one item records the flag.
  const nominationFlags = [...assets, ...invs, ...policies].map((i) => (i.payload as { nomineeSet?: boolean }).nomineeSet).filter((v): v is boolean => v !== undefined);
  const nominationsSet = nominationFlags.length ? nominationFlags.every(Boolean) : undefined;
  if (nominationFlags.length) provided.add("nominationsSet");

  // Goals
  const mappedGoals = goals.map((g) => ({
    targetToday: g.payload.targetToday,
    years: monthsBetween(now, g.targetDate) / 12,
    assigned: g.payload.assignedAmount,
    monthlySip: g.payload.monthlySip,
  }));
  if (goals.length) provided.add("goals");

  return {
    age: age ?? DEFAULT_AGE,
    employment: user.employment,
    dualIncome: earners >= 2,
    dependants,
    cityTier: user.cityTier,
    retirementAge: user.retirementAge ?? undefined,
    monthlyIncome,
    monthlyExpenses,
    monthlyEssentialExpenses,
    liquidAssets,
    investments,
    retirementCorpus,
    monthlyEmi,
    highCostDebt,
    totalDebt,
    lifeCover,
    healthCover,
    goals: mappedGoals.length ? mappedGoals : undefined,
    nominationsSet,
    willInPlace: undefined,
    monthlyRetirementSip,
    provided: SNAPSHOT_FIELDS.filter((f) => provided.has(f)),
  };
}

function healthCoverPerHousehold(policies: FinancialItem<"insurance">[], members: Member[]): number {
  const health = policies.filter((p) => HEALTH_FLOATER_TYPES.has(p.type) || HEALTH_INDIVIDUAL_TYPES.has(p.type));
  if (!health.length) return 0;
  const covers = (p: FinancialItem<"insurance">, memberId: string) => {
    const ids = (p.payload as Payload<"insurance">).coveredMemberIds;
    if (ids.length) return ids.includes(memberId);
    return HEALTH_FLOATER_TYPES.has(p.type) || p.memberId === null || p.memberId === memberId;
  };
  const perMember = (memberId: string) => {
    let floater = 0;
    let individual = 0;
    for (const p of health) {
      if (!covers(p, memberId)) continue;
      if (HEALTH_FLOATER_TYPES.has(p.type)) floater = Math.max(floater, p.payload.sumAssured);
      else individual = Math.max(individual, p.payload.sumAssured);
    }
    return Math.max(floater, individual);
  };
  if (!members.length) return Math.max(...health.map((p) => p.payload.sumAssured));
  return Math.min(...members.map((m) => perMember(m.id)));
}

/** Fields still missing from a snapshot, most valuable first (shown next to a low confidence). */
export function missingFields(provided: string[] | undefined, limit = 5): SnapshotField[] {
  const have = new Set(provided ?? []);
  return SNAPSHOT_FIELDS.filter((f) => !have.has(f)).slice(0, limit);
}
