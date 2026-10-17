import { describe, expect, it } from "vitest";
import { getRulePack, resolvePlaceholders } from "./index";

describe("rule pack", () => {
  it("validates and loads the current India pack", () => {
    const p = getRulePack();
    expect(p.country).toBe("IN");
    expect(p.scoring.dimensions).toHaveLength(8);
  });
  it("rejects unknown versions", () => {
    expect(() => getRulePack("india-1999.v0")).toThrow();
  });
  it("resolves content placeholders and leaves unknown ones visible", () => {
    expect(resolvePlaceholders("Limit is {section_80c_limit}.")).toBe("Limit is ₹1,50,000.");
    expect(resolvePlaceholders("PPF pays {ppf_rate}.")).toBe("PPF pays 7.1%.");
    expect(resolvePlaceholders("{not_a_key}")).toBe("{not_a_key}");
  });
});
