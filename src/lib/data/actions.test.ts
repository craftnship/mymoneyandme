import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { _resetForTests, getPool } from "../db";
import { createUser, findUserById, householdForUser } from "../auth/users";
import { listItems, listMembers } from "./store";

/**
 * The Server Actions with a real database and only the session read mocked:
 * requireHousehold returns the test household, and redirect() throws like the
 * real one so the "happy path" is observable as the target URL.
 */
const current = { userId: "", householdId: "" };
class Redirect extends Error { constructor(public readonly to: string) { super(`redirect:${to}`); } }

vi.mock("../auth/current", () => ({
  requireHousehold: async () => ({ user: await findUserById(current.userId), household: { id: current.householdId, name: "Test" } }),
  getCurrentUser: async () => findUserById(current.userId),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirect(to); }, notFound: () => { throw new Error("notFound"); } }));

const { quickStart, saveMember, archiveMemberAction, saveItem, archiveItemAction } = await import("./actions");

const url = process.env.DATABASE_URL;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function expectRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  throw new Error("expected a redirect");
}

const quick = { locale: "ta", dob: "1991-03-04", gender: "preferNot", maritalStatus: "married", dependants: "1", city: "Chennai", state: "Tamil Nadu", pin: "600001", cityTier: "1", employment: "selfEmployed", monthlyIncome: "120000", monthlyExpenses: "70000" };

describe.skipIf(!url)("data Server Actions", () => {
  beforeAll(async () => {
    const p = await getPool();
    for (const t of ["audit_events", "financial_items", "household_members", "households", "consents", "email_tokens", "sessions", "users"]) await p.query(`DELETE FROM ${t}`);
    const u = await createUser({ email: "actions@example.in", passwordHash: "x", name: "Kavya", locale: "en" });
    current.userId = u.id;
    current.householdId = (await householdForUser(u.id))!.id;
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("quick start returns field errors without touching the profile", async () => {
    const r = await quickStart({}, fd({ ...quick, dob: "2099-01-01", monthlyIncome: "" }));
    expect(r.fieldErrors).toEqual({ dob: "futureDate", monthlyIncome: "required" });
    expect((await findUserById(current.userId))!.city).toBeNull();
    expect(await listItems(current.householdId)).toEqual([]);
  });

  it("quick start saves the profile, seeds income and expenses, then shows the first look", async () => {
    expect(await expectRedirect(quickStart({}, fd(quick)))).toBe("/ta/app/welcome?look=1");
    const u = (await findUserById(current.userId))!;
    expect(u).toMatchObject({ dob: "1991-03-04", gender: "preferNot", maritalStatus: "married", dependants: 1, city: "Chennai", state: "Tamil Nadu", pin: "600001", cityTier: 1, employment: "selfEmployed" });
    const items = await listItems(current.householdId);
    const income = items.find((i) => i.family === "income")!;
    const expenses = items.find((i) => i.family === "expenses")!;
    expect(items.length).toBe(2);
    expect(income.type).toBe("business"); // self-employed seeds business income, not salary
    expect(income.payload).toMatchObject({ netMonthly: 120000 });
    expect(income.memberId).toBe((await listMembers(current.householdId))[0].id);
    expect(expenses.type).toBe("other");
    expect(expenses.payload).toMatchObject({ label: "Monthly expenses", monthly: 70000 });

    // Edit mode: profile only, no duplicate items, straight back to the data overview.
    expect(await expectRedirect(quickStart({}, fd({ ...quick, locale: "en", city: "Madurai", monthlyIncome: "", monthlyExpenses: "" })))).toBe("/en/app/data");
    expect((await findUserById(current.userId))!.city).toBe("Madurai");
    expect((await listItems(current.householdId)).length).toBe(2);
  });

  it("members: add, edit, archive, and users.dependants follows", async () => {
    expect(await expectRedirect(saveMember({}, fd({ locale: "en", name: "Arjun", relation: "child", dob: "2016-06-01", dependant: "on" })))).toBe("/en/app/data/members");
    expect(await expectRedirect(saveMember({}, fd({ locale: "en", name: "Dev", relation: "spouse", earns: "on" })))).toBe("/en/app/data/members");
    expect((await findUserById(current.userId))!.dependants).toBe(1);
    const members = await listMembers(current.householdId);
    const spouse = members.find((m) => m.name === "Dev")!;
    const self = members.find((m) => m.relation === "self")!;

    expect(await saveMember({}, fd({ locale: "en", id: spouse.id, name: "", relation: "spouse" }))).toEqual({ fieldErrors: { name: "required" } });
    expect(await saveMember({}, fd({ locale: "en", id: self.id, name: "Someone", relation: "other" }))).toEqual({ error: "selfLocked" });
    expect(await expectRedirect(saveMember({}, fd({ locale: "en", id: spouse.id, name: "Dev", relation: "spouse", dependant: "on" })))).toBe("/en/app/data/members");
    expect((await findUserById(current.userId))!.dependants).toBe(2);

    await expectRedirect(archiveMemberAction(fd({ locale: "en", id: spouse.id })));
    await expectRedirect(archiveMemberAction(fd({ locale: "en", id: self.id })));
    expect((await listMembers(current.householdId)).map((m) => m.name)).toEqual(["Kavya", "Arjun"]);
    expect((await findUserById(current.userId))!.dependants).toBe(1);
  });

  it("items: validation errors, create, edit, cross-family guard and archive", async () => {
    expect(await saveItem({}, fd({ locale: "en", family: "loans", type: "home", outstanding: "" }))).toEqual({ fieldErrors: { outstanding: "required" } });
    expect(await expectRedirect(saveItem({}, fd({ locale: "en", family: "loans", type: "home", label: "SBI", outstanding: "3000000", emi: "28000", interestPct: "8.4", insured: "on" })))).toBe("/en/app/data/loans");
    const loan = (await listItems(current.householdId, "loans"))[0];
    expect(loan.payload).toMatchObject({ label: "SBI", outstanding: 3000000, emi: 28000, interestPct: 8.4, insured: true, prepaymentPenalty: false });

    expect(await saveItem({}, fd({ locale: "en", family: "assets", id: loan.id, type: "cash", currentValue: "1" }))).toEqual({ error: "notFound" });
    await expectRedirect(saveItem({}, fd({ locale: "en", family: "loans", id: loan.id, type: "car", outstanding: "250000", confidence: "verified" })));
    const edited = (await listItems(current.householdId, "loans"))[0];
    expect(edited).toMatchObject({ id: loan.id, type: "car", confidence: "verified" });
    expect(edited.payload).toMatchObject({ outstanding: 250000, emi: 0, insured: false });

    await expectRedirect(archiveItemAction(fd({ locale: "en", family: "assets", id: loan.id })));
    expect((await listItems(current.householdId, "loans")).length).toBe(1);
    await expectRedirect(archiveItemAction(fd({ locale: "en", family: "loans", id: loan.id })));
    expect(await listItems(current.householdId, "loans")).toEqual([]);
  });
});
