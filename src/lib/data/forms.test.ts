import { describe, expect, it } from "vitest";
import { ageFromDob, parseFirstLook, parseItem, parseMember, parseProfileStep, parseQuickStart } from "./forms";
import { nextProfileStep, profileStepProgress, withStepDone } from "./profileSteps";

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

const goodQuickStart = { dob: "1990-05-01", gender: "preferNot", maritalStatus: "married", dependants: "2", city: "Chennai", state: "Tamil Nadu", pin: "600001", cityTier: "1", employment: "salaried", monthlyIncome: "100000", monthlyExpenses: "60000" };

describe("parseQuickStart", () => {
  it("accepts a complete form", () => {
    const r = parseQuickStart(fd(goodQuickStart));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ dob: "1990-05-01", dependants: 2, cityTier: 1, monthlyIncome: 100000, pin: "600001" });
  });

  it("reports a key per invalid field", () => {
    const r = parseQuickStart(fd({ ...goodQuickStart, dob: "2090-01-01", state: "Narnia", pin: "12", cityTier: "4", monthlyIncome: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toEqual({ dob: "futureDate", state: "invalid", pin: "invalidPin", cityTier: "invalid", monthlyIncome: "required" });
  });

  it("treats optional fields left blank as absent, and amounts as optional in edit mode", () => {
    const r = parseQuickStart(fd({ ...goodQuickStart, gender: "", pin: "", monthlyIncome: "", monthlyExpenses: "" }), { requireAmounts: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ gender: undefined, pin: undefined, monthlyIncome: undefined });
    const strict = parseQuickStart(fd({ ...goodQuickStart, monthlyExpenses: "" }));
    expect(strict).toEqual({ ok: false, fieldErrors: { monthlyExpenses: "required" } });
  });
});

describe("parseMember", () => {
  it("reads checkboxes and rejects a bad relation", () => {
    const ok = parseMember(fd({ name: " Priya ", relation: "spouse", dob: "", earns: "on" }));
    expect(ok).toEqual({ ok: true, data: { name: "Priya", relation: "spouse", dob: undefined, earns: true, dependant: false } });
    const bad = parseMember(fd({ name: "", relation: "self" }));
    expect(bad).toEqual({ ok: false, fieldErrors: { name: "required", relation: "invalid" } });
  });
});

describe("parseItem", () => {
  const members = ["11111111-1111-1111-1111-111111111111"];

  it("builds an income payload with explicit checkbox values", () => {
    const r = parseItem("income", fd({ type: "salary", confidence: "verified", memberId: members[0], label: "Infosys", netMonthly: "85000", grossMonthly: "", frequency: "monthly" }), members);
    expect(r).toEqual({ ok: true, data: { type: "salary", memberId: members[0], confidence: "verified", payload: { label: "Infosys", netMonthly: 85000, frequency: "monthly", taxable: false, grossMonthly: undefined, growthPct: undefined, startDate: undefined, endDate: undefined } } });
  });

  it("requires the headline amount and rejects unknown types, members and confidence", () => {
    const r = parseItem("assets", fd({ type: "yacht", confidence: "guessed", memberId: "nobody", currentValue: "" }), members);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toEqual({ type: "invalid", confidence: "invalid", memberId: "invalid", currentValue: "required" });
  });

  it("keeps only known members in a covered-members list and defaults selects", () => {
    const r = parseItem("insurance", fd({ type: "healthFloater", sumAssured: "1000000", premium: "18000", frequency: "yearly", coveredMemberIds: [members[0], "stranger"] }), members);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.payload).toMatchObject({ sumAssured: 1000000, premium: 18000, frequency: "yearly", coveredMemberIds: [members[0]], insurerType: "private", nomineeSet: false });
  });

  it("maps range errors to keys", () => {
    const r = parseItem("investments", fd({ type: "stocks", currentValue: "5000", sipDate: "40", lockInUntil: "soon" }), members);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toEqual({ sipDate: "tooBig", lockInUntil: "invalid" });
  });
});

describe("ageFromDob", () => {
  it("counts completed years", () => {
    const now = new Date("2026-10-18T00:00:00Z");
    expect(ageFromDob("1990-10-19", now)).toBe(35);
    expect(ageFromDob("1990-10-18", now)).toBe(36);
    expect(ageFromDob(null)).toBeNull();
  });
});

describe("parseFirstLook", () => {
  it("needs only income and expenses; savings and cover default to unknown", () => {
    const r = parseFirstLook(fd({ monthlyIncome: "100000", monthlyExpenses: "60000", emergencySavings: "" }));
    expect(r).toEqual({ ok: true, data: { monthlyIncome: 100000, monthlyExpenses: 60000, emergencySavings: undefined, termCover: "notSure", healthCover: "notSure" } });
  });
  it("reads the answers and rejects missing amounts or a bad cover answer", () => {
    const r = parseFirstLook(fd({ monthlyIncome: "100000", monthlyExpenses: "60000", emergencySavings: "250000", termCover: "no", healthCover: "yes" }));
    expect(r.ok && r.data).toMatchObject({ emergencySavings: 250000, termCover: "no", healthCover: "yes" });
    const bad = parseFirstLook(fd({ monthlyIncome: "", termCover: "maybe" }));
    expect(bad).toEqual({ ok: false, fieldErrors: { monthlyIncome: "required", monthlyExpenses: "required", termCover: "invalid" } });
  });
});

describe("profile steps", () => {
  it("validates one question at a time", () => {
    expect(parseProfileStep("dob", fd({ dob: "1990-05-01" }))).toEqual({ ok: true, data: { dob: "1990-05-01" } });
    expect(parseProfileStep("dob", fd({ dob: "2090-01-01" }))).toEqual({ ok: false, fieldErrors: { dob: "futureDate" } });
    expect(parseProfileStep("cityTier", fd({ cityTier: "2" }))).toEqual({ ok: true, data: { cityTier: 2 } });
    expect(parseProfileStep("employment", fd({ employment: "astronaut" })).ok).toBe(false);
  });
  it("asks the questions in order, skipping ones already answered or skipped", () => {
    expect(nextProfileStep({ profileSteps: [], city: null })).toBe("dob");
    expect(nextProfileStep({ profileSteps: ["dob", "employment"], city: null })).toBe("dependants");
    expect(nextProfileStep({ profileSteps: ["dob", "employment", "dependants", "cityTier"], city: null })).toBeNull();
    expect(profileStepProgress({ profileSteps: ["employment"], city: null })).toEqual({ done: 1, total: 4 });
  });
  it("treats accounts from the long quick start as complete", () => {
    expect(nextProfileStep({ profileSteps: [], city: "Chennai" })).toBeNull();
  });
  it("records a step once, in order", () => {
    expect(withStepDone(["cityTier"], "dob")).toBe("dob,cityTier");
    expect(withStepDone(["dob"], "dob")).toBe("dob");
  });
});
