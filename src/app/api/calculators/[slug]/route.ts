import { NextResponse } from "next/server";
import { getCalculator, runCalculator } from "@/lib/calculators";

/** Server-side calculation for saved results: the response carries the rule-pack version used. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const def = getCalculator(slug);
  if (!def) return NextResponse.json({ error: "Unknown calculator" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const inputs: Record<string, number> = {};
  for (const i of def.inputs) {
    const v = body[i.key];
    if (typeof v === "number" && Number.isFinite(v)) inputs[i.key] = v;
  }
  return NextResponse.json({ ...runCalculator(slug, inputs), computedAt: new Date().toISOString() });
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const def = getCalculator(slug);
  if (!def) return NextResponse.json({ error: "Unknown calculator" }, { status: 404 });
  return NextResponse.json(def);
}
