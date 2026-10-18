import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword, verifyPassword } from "./password";

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batter", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("enforces length before any network check", async () => {
    expect(await checkPassword("short", { breachCheck: false })).toBe("tooShort");
    expect(await checkPassword("a".repeat(129), { breachCheck: false })).toBe("tooLong");
    expect(await checkPassword("long enough passphrase", { breachCheck: false })).toBeNull();
  });
});
