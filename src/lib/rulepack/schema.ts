import { z } from "zod";

// Declarative rule format (section 9): metric, comparator, threshold, score.
// Bands are evaluated top to bottom; the first matching band wins.
export const bandSchema = z
  .object({
    gte: z.number().optional(),
    lte: z.number().optional(),
    score: z.number().min(0).max(100),
  })
  .refine((b) => b.gte !== undefined || b.lte !== undefined, {
    message: "A band needs gte or lte",
  });

export const ruleSchema = z.object({
  metric: z.string(),
  points: z.array(bandSchema).min(1),
  share: z.number().min(0).max(1),
});

export const dimensionSchema = z.object({
  key: z.enum([
    "cashflow",
    "emergency",
    "debt",
    "insurance",
    "investments",
    "retirement",
    "goals",
    "hygiene",
  ]),
  weight: z.number().min(0).max(100),
  rules: z.array(ruleSchema).min(1),
  targetMonths: z.record(z.string(), z.number()).optional(),
  targetEquityByAge: z
    .object({ formula: z.string(), min: z.number(), max: z.number() })
    .optional(),
});

const slabSchema = z.object({ upTo: z.number().nullable(), rate: z.number() });

export const rulePackSchema = z.object({
  version: z.string(),
  country: z.literal("IN"),
  currency: z.literal("INR"),
  effectiveFrom: z.string(),
  financialYear: z.string(),
  assessmentYear: z.string(),
  notes: z.string().optional(),
  assumptions: z.object({
    inflationGeneral: z.number(),
    inflationEducation: z.number(),
    inflationHealthcare: z.number(),
    inflationLifestyle: z.number(),
    returnEquity: z.number(),
    returnDebt: z.number(),
    returnGold: z.number(),
    returnRealEstate: z.number(),
    returnLiquid: z.number(),
    returnBalanced: z.number(),
    returnPostRetirement: z.number(),
    salaryGrowth: z.number(),
    lifeExpectancy: z.number(),
    defaultRetirementAge: z.number(),
    safeWithdrawalRate: z.number(),
  }),
  tax: z.object({
    newRegime: z.object({
      slabs: z.array(slabSchema),
      standardDeduction: z.number(),
      rebate87A: z.object({ incomeLimit: z.number(), maxRebate: z.number() }),
    }),
    oldRegime: z.object({
      slabs: z.array(slabSchema),
      standardDeduction: z.number(),
      rebate87A: z.object({ incomeLimit: z.number(), maxRebate: z.number() }),
      deductionLimits: z.record(z.string(), z.number()),
    }),
    cess: z.number(),
    surcharge: z.array(z.object({ above: z.number(), rate: z.number() })),
    capitalGains: z.record(z.string(), z.unknown()),
  }),
  schemes: z.record(z.string(), z.record(z.string(), z.unknown())),
  insurance: z.object({
    termCoverMultipleOfIncome: z.object({ min: z.number(), max: z.number() }),
    healthCoverByCityTier: z.record(z.string(), z.number()),
    maxPremiumShareOfIncome: z.number(),
  }),
  scoring: z.object({
    grades: z.array(z.object({ min: z.number(), grade: z.string() })),
    dimensions: z.array(dimensionSchema).length(8),
    lifeStageWeightAdjustments: z.record(z.string(), z.record(z.string(), z.number())),
  }),
  disclaimer: z.record(z.string(), z.string()),
});

export type RulePack = z.infer<typeof rulePackSchema>;
export type Dimension = z.infer<typeof dimensionSchema>;
export type DimensionKey = Dimension["key"];
export type Rule = z.infer<typeof ruleSchema>;
export type Band = z.infer<typeof bandSchema>;
export type TaxSlab = z.infer<typeof slabSchema>;
