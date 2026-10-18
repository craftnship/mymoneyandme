import { describe, expect, it } from "vitest";
import { ageOn, profileSchema, scoreRisk } from "./profile";
import { approximateIp, describeDevice } from "./device";

const valid = {
  name: "Priya", preferredName: "", dob: "1990-05-20", gender: "preferNot", maritalStatus: "", city: "Chennai", state: "TN", pin: "600001", cityTier: "1",
  locale: "ta", numberFormat: "indian", employment: "salaried", retirementAge: "60", smoker: "", existingConditions: "no",
};

describe("profile validation", () => {
  it("accepts a full profile and normalises blanks to null", () => {
    const p = profileSchema.parse(valid);
    expect(p).toMatchObject({ preferredName: null, maritalStatus: null, state: "TN", pin: "600001", retirementAge: 60, smoker: null, existingConditions: false, locale: "ta" });
  });

  it("rejects bad PIN, retirement age, under-18 dates and unknown states", () => {
    expect(profileSchema.safeParse({ ...valid, pin: "012345" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, pin: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, retirementAge: "39" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, retirementAge: "" }).data?.retirementAge).toBeNull();
    const minor = `${new Date().getUTCFullYear() - 10}-01-01`;
    expect(profileSchema.safeParse({ ...valid, dob: minor }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, dob: "1990-02-30" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, state: "XX" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, locale: "hi" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, name: "" }).error?.issues[0].path).toEqual(["name"]);
  });

  it("computes age from a date of birth", () => {
    expect(ageOn("1990-05-20", new Date(Date.UTC(2026, 4, 19)))).toBe(35);
    expect(ageOn("1990-05-20", new Date(Date.UTC(2026, 4, 20)))).toBe(36);
  });
});

describe("risk questionnaire", () => {
  it("maps totals to the three profiles", () => {
    expect(scoreRisk({ horizon: "1", drop: "1", experience: "1", income: "2", priority: "2" })).toBe("conservative");
    expect(scoreRisk({ horizon: "2", drop: "1", experience: "2", income: "2", priority: "1" })).toBe("balanced");
    expect(scoreRisk({ horizon: "3", drop: "3", experience: "2", income: "2", priority: "2" })).toBe("growth");
  });
});

describe("session display helpers", () => {
  it("summarises user agents", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toEqual({ browser: "Safari", platform: "iOS" });
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0")).toEqual({ browser: "Edge", platform: "Windows" });
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36")).toEqual({ browser: "Chrome", platform: "Android" });
    expect(describeDevice(null)).toEqual({ browser: "unknown", platform: "unknown" });
  });

  it("masks addresses", () => {
    expect(approximateIp("203.0.113.42")).toBe("203.0.113.x");
    expect(approximateIp("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2:…");
    expect(approximateIp(null)).toBeNull();
    expect(approximateIp("local")).toBeNull();
  });
});
