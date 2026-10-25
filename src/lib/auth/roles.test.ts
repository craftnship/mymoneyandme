import { describe, expect, it } from "vitest";
import { adminEmails, decideAdminAccess } from "./roles";

const admins = adminEmails(" Santa@Example.in , ops@example.in,");

describe("admin access", () => {
  it("parses ADMIN_EMAILS case-insensitively", () => {
    expect([...admins]).toEqual(["santa@example.in", "ops@example.in"]);
    expect(adminEmails("").size).toBe(0);
  });

  it("promotes a verified listed account and lets it in with a passkey", () => {
    expect(decideAdminAccess({ email: "santa@example.in", emailVerified: true, role: "member" }, "passkey", admins)).toEqual({ ok: true, role: "admin", promote: true });
    expect(decideAdminAccess({ email: "santa@example.in", emailVerified: true, role: "admin" }, "passkey", admins)).toEqual({ ok: true, role: "admin", promote: false });
  });

  it("asks for a passkey on password and email-link sessions, but still records the promotion", () => {
    expect(decideAdminAccess({ email: "SANTA@example.in", emailVerified: true, role: "member" }, "password", admins)).toEqual({ ok: false, reason: "needsPasskey", promote: true });
    expect(decideAdminAccess({ email: "x@example.in", emailVerified: true, role: "editor" }, "emailLink", admins)).toEqual({ ok: false, reason: "needsPasskey", promote: false });
    expect(decideAdminAccess({ email: "x@example.in", emailVerified: true, role: "editor" }, null, admins)).toEqual({ ok: false, reason: "needsPasskey", promote: false });
  });

  it("never promotes an unverified address or an unlisted member", () => {
    expect(decideAdminAccess({ email: "santa@example.in", emailVerified: false, role: "member" }, "passkey", admins)).toEqual({ ok: false, reason: "notStaff", promote: false });
    expect(decideAdminAccess({ email: "someone@example.in", emailVerified: true, role: "member" }, "passkey", admins)).toEqual({ ok: false, reason: "notStaff", promote: false });
  });

  it("lets an editor in without ADMIN_EMAILS", () => {
    expect(decideAdminAccess({ email: "writer@example.in", emailVerified: true, role: "editor" }, "passkey", new Set())).toEqual({ ok: true, role: "editor", promote: false });
  });
});
