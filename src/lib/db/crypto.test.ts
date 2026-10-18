import { describe, expect, it } from "vitest";
import { decryptJson, decryptString, encryptJson, encryptString, safeEqual, sha256 } from "./crypto";

describe("field encryption", () => {
  it("round-trips strings and JSON with a fresh nonce each time", () => {
    const a = encryptString("₹1,50,000");
    const b = encryptString("₹1,50,000");
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe("₹1,50,000");
    expect(decryptJson(encryptJson({ amount: 150000, note: "தமிழ்" }))).toEqual({ amount: 150000, note: "தமிழ்" });
  });

  it("rejects tampered ciphertext", () => {
    const sealed = encryptString("secret");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decryptString(parts.join("."))).toThrow();
  });

  it("hashes tokens deterministically and compares in constant time", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});
