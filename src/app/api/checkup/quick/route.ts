import { NextResponse } from "next/server";
import { z } from "zod";
import { runQuickCheck } from "@/lib/checkup/engine";
import { buildPlan } from "@/lib/checkup/plan";
import { recordEvent } from "@/lib/events/store";

const schema = z.object({
  age: z.number().min(18).max(100),
  monthlyIncome: z.number().min(0).max(1e9),
  monthlyExpenses: z.number().min(0).max(1e9),
  emergencySavings: z.number().min(0).max(1e12),
  monthlyEmi: z.number().min(0).max(1e9),
  hasTermCover: z.boolean(),
  hasHealthCover: z.boolean(),
});

/** Public quick check (section 9): same engine, defaults for missing data, labelled approximate. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const checkup = runQuickCheck(parsed.data);
  const plan = buildPlan(checkup, parsed.data.monthlyIncome);
  void recordEvent("quickCheckRun", null, req.headers.get("x-locale"));
  return NextResponse.json({ checkup, plan, approximate: true });
}
