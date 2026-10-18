import { describe, expect, it } from "vitest";
import { completeness, completenessHref } from "./completeness";
import { familyTotals, softWarnings } from "./summary";
import type { Family } from "./model";

const blankUser = { dob: null, maritalStatus: null, city: null, state: null, retirementAge: null, riskProfile: null, dependants: 0 };
const fullUser = { dob: "1990-05-01", maritalStatus: "married", city: "Chennai", state: "Tamil Nadu", retirementAge: 60, riskProfile: "balanced", dependants: 1 };
const item = (family: Family, type: string, payload: Record<string, unknown>) => ({ family, type, payload });

describe("completeness", () => {
  it("starts at zero with income as the most valuable next field", () => {
    const c = completeness(blankUser, [{ relation: "self" }], []);
    expect(c.percent).toBe(5); // a single person with no dependants is not asked for members
    expect(c.nextField).toBe("income");
    expect(completenessHref(c.nextField!)).toBe("/app/data/income/new");
  });

  it("moves to the next most valuable field as data arrives", () => {
    const c = completeness(blankUser, [{ relation: "self" }], [item("income", "salary", { netMonthly: 1 })]);
    expect(c.nextField).toBe("expenses");
    expect(c.percent).toBe(25);
    const c2 = completeness({ ...blankUser, dob: "1990-01-01" }, [{ relation: "self" }], [item("income", "salary", {}), item("expenses", "other", {})]);
    expect(c2.nextField).toBe("liquidAssets");
    expect(c2.percent).toBe(50);
  });

  it("only asks for members when the profile says there is a family", () => {
    const single = completeness({ ...blankUser, maritalStatus: "single" }, [{ relation: "self" }], []);
    expect(single.missing).not.toContain("members");
    const married = completeness({ ...blankUser, maritalStatus: "married" }, [{ relation: "self" }], []);
    expect(married.missing).toContain("members");
    const withSpouse = completeness({ ...blankUser, maritalStatus: "married" }, [{ relation: "self" }, { relation: "spouse" }], []);
    expect(withSpouse.missing).not.toContain("members");
  });

  it("reaches 100 with everything filled", () => {
    const items = [
      item("income", "salary", {}), item("expenses", "housing", {}), item("assets", "cash", {}), item("insurance", "termLife", {}),
      item("investments", "stocks", {}), item("loans", "home", {}),
    ];
    const c = completeness(fullUser, [{ relation: "self" }, { relation: "child" }], items);
    expect(c.percent).toBe(100);
    expect(c.nextField).toBeNull();
  });
});

describe("family totals and soft warnings", () => {
  it("sums the headline amount per family", () => {
    const totals = familyTotals([item("income", "salary", { netMonthly: 80000 }), item("income", "rental", { netMonthly: 20000 }), item("loans", "home", { outstanding: 3000000, emi: 25000 })]);
    expect(totals.find((t) => t.family === "income")).toEqual({ family: "income", count: 2, total: 100000, monthly: true });
    expect(totals.find((t) => t.family === "loans")).toEqual({ family: "loans", count: 1, total: 3000000, monthly: false });
    expect(totals.find((t) => t.family === "assets")?.count).toBe(0);
  });

  it("flags expenses above income and EMIs above expenses", () => {
    const w = softWarnings([item("income", "salary", { netMonthly: 50000 }), item("expenses", "other", { monthly: 60000 }), item("loans", "car", { outstanding: 1, emi: 70000 })]);
    expect(w.map((x) => x.kind)).toEqual(["expensesOverIncome", "emiOverExpenses"]);
  });

  it("flags life cover far below ten times annual income only when a life policy exists", () => {
    const base = [item("income", "salary", { netMonthly: 100000 })];
    expect(softWarnings(base)).toEqual([]);
    expect(softWarnings([...base, item("insurance", "termLife", { sumAssured: 500000 })])).toEqual([{ kind: "lowLifeCover", cover: 500000, target: 12000000 }]);
    expect(softWarnings([...base, item("insurance", "termLife", { sumAssured: 10000000 })])).toEqual([]);
    expect(softWarnings([...base, item("insurance", "healthFloater", { sumAssured: 500000 })])).toEqual([]);
  });
});
