/**
 * Calculator definitions are plain JSON-serialisable objects (section 6): an
 * admin can add a calculator for an existing formula family without a code
 * deployment. Labels are message keys under `calc.labels.*` so one translation
 * covers every calculator that shares an input.
 */
export type InputKind = "currency" | "percent" | "years" | "months" | "number" | "select" | "age";

export type RulePackRef = { ref: string }; // dotted path into the rule pack, e.g. "assumptions.inflationGeneral"

export type InputDef = {
  key: string;
  kind: InputKind;
  label: string; // message key under calc.labels
  default: number | RulePackRef;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; label: string }[]; // for kind === "select"
  help?: string; // message key under calc.help (optional)
  assumption?: boolean; // shown in the "assumptions" group and labelled as such
};

export type OutputKind = "currency" | "percent" | "number" | "years" | "months" | "text";

export type OutputDef = {
  key: string;
  kind: OutputKind;
  label: string; // message key under calc.labels
  headline?: boolean;
};

export type ChartKind = "growth" | "split" | "amortisation" | "none";

export type CalculatorGroup =
  | "savings"
  | "fixedIncome"
  | "loans"
  | "insurance"
  | "retirement"
  | "goals"
  | "tax"
  | "budgeting"
  | "misc";

export type CalculatorDef = {
  slug: string;
  group: CalculatorGroup;
  formula: string; // formula family id, see formulas.ts
  inputs: InputDef[];
  outputs: OutputDef[];
  chart: ChartKind;
  relatedArticle?: string;
  relatedChapter?: string; // "track/module/chapter"
  featured?: boolean;
};

export type SeriesPoint = { period: number; [key: string]: number };

export type FormulaResult = {
  values: Record<string, number | string>;
  series?: SeriesPoint[]; // year-by-year or month-by-month rows for charts and tables
  split?: { key: string; value: number }[]; // for pie-style breakdowns
};

export type Formula = (inputs: Record<string, number>, ctx: FormulaContext) => FormulaResult;

export type FormulaContext = {
  rulePackVersion: string;
  assumptions: Record<string, number>;
};
