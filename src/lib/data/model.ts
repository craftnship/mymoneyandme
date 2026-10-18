import { z } from "zod";

/**
 * The six financial data families (section 8). Every item is a row in
 * financial_items with family, type, optional member and an encrypted JSON
 * payload validated by the schema below. Keep this file free of server-only
 * imports: forms on the client use the same lists and schemas.
 */
export const FAMILIES = ["income", "expenses", "assets", "investments", "loans", "insurance"] as const;
export type Family = (typeof FAMILIES)[number];

export const ITEM_TYPES: Record<Family, readonly string[]> = {
  income: ["salary", "business", "rental", "interestDividends", "pension", "freelance", "other"],
  expenses: ["housing", "food", "utilities", "transport", "education", "healthcare", "insurancePremiums", "lifestyle", "subscriptions", "dependants", "charity", "other"],
  assets: ["cash", "fixedDeposit", "realEstateSelf", "realEstateLetOut", "land", "gold", "vehicle", "businessEquity", "employeeStock", "epf", "ppf", "nps", "receivable"],
  investments: ["mutualFundEquity", "mutualFundDebt", "mutualFundHybrid", "stocks", "etf", "bonds", "governmentScheme", "crypto", "ulip", "insuranceSavings", "alternative"],
  loans: ["home", "car", "personal", "education", "gold", "creditCard", "family", "bnpl"],
  insurance: ["termLife", "endowment", "healthIndividual", "healthFloater", "healthEmployer", "criticalIllness", "personalAccident", "motor", "home", "travel"],
};

export const CONFIDENCE = ["entered", "imported", "verified"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

const inr = z.coerce.number().min(0).max(1e12);
const pct = z.coerce.number().min(0).max(100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));
const frequency = z.enum(["monthly", "quarterly", "yearly"]).default("monthly");

export const PAYLOAD_SCHEMAS = {
  income: z.object({
    label: z.string().trim().max(80).default(""),
    grossMonthly: inr.optional(),
    netMonthly: inr, // take-home, used by the check-up
    frequency,
    growthPct: pct.optional(),
    startDate: date,
    endDate: date,
    taxable: z.coerce.boolean().default(true),
  }),
  expenses: z.object({
    label: z.string().trim().max(80).default(""),
    monthly: inr,
    fixed: z.coerce.boolean().default(true),
    essential: z.coerce.boolean().default(true),
    inflationLinked: z.coerce.boolean().default(true),
  }),
  assets: z.object({
    label: z.string().trim().max(80).default(""),
    currentValue: inr,
    purchaseValue: inr.optional(),
    purchaseDate: date,
    valuationDate: date,
    liquidity: z.enum(["liquid", "nearLiquid", "illiquid"]).default("liquid"),
    linkedLoanId: z.string().max(36).optional(),
    nomineeSet: z.coerce.boolean().optional(),
  }),
  investments: z.object({
    label: z.string().trim().max(80).default(""),
    invested: inr.optional(),
    currentValue: inr,
    units: z.coerce.number().min(0).optional(),
    sipMonthly: inr.default(0),
    sipDate: z.coerce.number().int().min(1).max(31).optional(),
    assetClass: z.enum(["equity", "debt", "gold", "realEstate", "other"]).default("equity"),
    risk: z.enum(["low", "medium", "high"]).default("medium"),
    lockInUntil: date,
    retirementTagged: z.coerce.boolean().default(false),
    nomineeSet: z.coerce.boolean().optional(),
  }),
  loans: z.object({
    label: z.string().trim().max(80).default(""),
    lenderType: z.enum(["bank", "nbfc", "employer", "family", "other"]).default("bank"),
    principal: inr.optional(),
    outstanding: inr,
    interestPct: pct.optional(),
    rateType: z.enum(["fixed", "floating"]).default("floating"),
    emi: inr.default(0),
    monthsLeft: z.coerce.number().int().min(0).max(600).optional(),
    prepaymentPenalty: z.coerce.boolean().default(false),
    insured: z.coerce.boolean().default(false),
    revolving: z.coerce.boolean().default(false), // credit card balance carried over
  }),
  insurance: z.object({
    label: z.string().trim().max(80).default(""),
    insurerType: z.enum(["private", "public", "employer"]).default("private"),
    sumAssured: inr,
    premium: inr.default(0),
    frequency,
    startDate: date,
    endDate: date,
    coveredMemberIds: z.array(z.string().max(36)).default([]),
    riders: z.string().trim().max(200).optional(),
    nomineeSet: z.coerce.boolean().optional(),
  }),
} as const;

export type Payload<F extends Family> = z.infer<(typeof PAYLOAD_SCHEMAS)[F]>;
export type AnyPayload = { [F in Family]: Payload<F> }[Family];

export type FinancialItem<F extends Family = Family> = {
  id: string;
  householdId: string;
  family: F;
  type: string;
  memberId: string | null;
  payload: Payload<F>;
  confidence: Confidence;
  createdAt: Date;
  updatedAt: Date;
};

export function isFamily(s: string): s is Family {
  return (FAMILIES as readonly string[]).includes(s);
}

/** Rates above this are "high-cost" for the debt dimension (rule pack default). */
export const HIGH_COST_RATE_PCT = 15;
