import { z } from "zod";

/**
 * Goal records (section 10). The clear columns hold what lists need (template,
 * name, date, priority); every amount lives in the encrypted payload. This file
 * has no server-only imports so forms can share the schema.
 */
export const GOAL_PRIORITIES = ["must", "should", "nice"] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

const inr = z.coerce.number().min(0).max(1e12);

export const GOAL_PAYLOAD_SCHEMA = z.object({
  targetToday: inr, // today's cost; inflated to the target date by the planner
  inflationPct: z.coerce.number().min(0).max(30),
  assignedAmount: inr.default(0), // existing assets or investments earmarked for this goal
  monthlySip: inr.default(0), // ongoing monthly investment towards it
});
export type GoalPayload = z.infer<typeof GOAL_PAYLOAD_SCHEMA>;

export type Goal = {
  id: string;
  householdId: string;
  memberId: string | null;
  template: string;
  name: string;
  targetDate: string; // YYYY-MM-DD
  priority: GoalPriority;
  flexibilityYears: number;
  payload: GoalPayload;
  createdAt: Date;
  updatedAt: Date;
};
