import type { User } from "../auth/users";
import type { Member } from "./store";
import type { FinancialItem } from "./model";

/**
 * Profile completeness (section 7): a weighted percentage plus the single next
 * most valuable missing field. Pure, so the dashboard and the data overview can
 * share it. Weights favour what the check-up needs most: income and expenses
 * first, then protection and the profile facts that drive life stage.
 */
export type CompletenessField =
  | "income" | "expenses" | "dob" | "liquidAssets" | "insurance" | "maritalStatus" | "city" | "members" | "investments" | "loans" | "state" | "retirementAge" | "riskProfile";

export type Completeness = { percent: number; nextField: CompletenessField | null; missing: CompletenessField[] };

type Check = { field: CompletenessField; weight: number; done: (ctx: Ctx) => boolean };
type Ctx = { user: Pick<User, "dob" | "maritalStatus" | "city" | "state" | "retirementAge" | "riskProfile" | "dependants">; members: Pick<Member, "relation">[]; items: Pick<FinancialItem, "family" | "type">[] };

const LIQUID_ASSET_TYPES = new Set(["cash", "fixedDeposit"]);

const CHECKS: Check[] = [
  { field: "income", weight: 20, done: ({ items }) => items.some((i) => i.family === "income") },
  { field: "expenses", weight: 15, done: ({ items }) => items.some((i) => i.family === "expenses") },
  { field: "dob", weight: 10, done: ({ user }) => Boolean(user.dob) },
  { field: "liquidAssets", weight: 10, done: ({ items }) => items.some((i) => i.family === "assets" && LIQUID_ASSET_TYPES.has(i.type)) },
  { field: "insurance", weight: 10, done: ({ items }) => items.some((i) => i.family === "insurance") },
  { field: "maritalStatus", weight: 5, done: ({ user }) => Boolean(user.maritalStatus) },
  { field: "city", weight: 5, done: ({ user }) => Boolean(user.city) },
  // Members matter once the profile says there is a family; a single person with no dependants is complete with just the self row.
  { field: "members", weight: 5, done: ({ user, members }) => (user.maritalStatus !== "married" && user.dependants === 0) || members.some((m) => m.relation !== "self") },
  { field: "investments", weight: 5, done: ({ items }) => items.some((i) => i.family === "investments") },
  { field: "loans", weight: 5, done: ({ items }) => items.some((i) => i.family === "loans") },
  { field: "state", weight: 4, done: ({ user }) => Boolean(user.state) },
  { field: "retirementAge", weight: 3, done: ({ user }) => user.retirementAge !== null && user.retirementAge !== undefined },
  { field: "riskProfile", weight: 3, done: ({ user }) => Boolean(user.riskProfile) },
];

export function completeness(user: Ctx["user"], members: Ctx["members"], items: Ctx["items"]): Completeness {
  const ctx = { user, members, items };
  const total = CHECKS.reduce((s, c) => s + c.weight, 0);
  let earned = 0;
  const missing: CompletenessField[] = [];
  for (const c of CHECKS) {
    if (c.done(ctx)) earned += c.weight;
    else missing.push(c.field);
  }
  return { percent: Math.round((earned / total) * 100), nextField: missing[0] ?? null, missing };
}

/** Where to send the user to fill a missing field. */
export function completenessHref(field: CompletenessField): string {
  switch (field) {
    case "income": return "/app/data/income/new";
    case "expenses": return "/app/data/expenses/new";
    case "liquidAssets": return "/app/data/assets/new";
    case "insurance": return "/app/data/insurance/new";
    case "investments": return "/app/data/investments/new";
    case "loans": return "/app/data/loans/new";
    case "members": return "/app/data/members/new";
    case "dob": case "maritalStatus": case "city": case "state": return "/app/welcome?edit=1";
    case "retirementAge": case "riskProfile": return "/app/settings";
  }
}
