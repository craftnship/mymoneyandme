import { describe, expect, it } from "vitest";
import { confirm, makeRateLimiter, subscribe, unsubscribe, type Mailer } from "./index";
import { MemoryStore } from "./store";
import { confirmationEmail } from "./mail";

function fakeMailer() {
  const sent: { to: string; url: string }[] = [];
  const mailer: Mailer = { async sendConfirmation(sub, url) { sent.push({ to: sub.email, url }); } };
  return { mailer, sent };
}

describe("newsletter double opt-in", () => {
  it("creates a pending subscriber and emails a confirmation link", async () => {
    const store = new MemoryStore();
    const { mailer, sent } = fakeMailer();
    const r = await subscribe(store, mailer, " Priya@Example.com ", "ta", "https://mymoneyandme.in");
    expect(r.outcome).toBe("pending");
    const sub = await store.findByEmail("priya@example.com");
    expect(sub?.status).toBe("pending");
    expect(sent[0].to).toBe("priya@example.com");
    expect(sent[0].url).toBe(`https://mymoneyandme.in/api/newsletter/confirm?token=${sub!.token}`);
  });

  it("confirms with the token, then unsubscribes, and rejects bad tokens", async () => {
    const store = new MemoryStore();
    const { mailer } = fakeMailer();
    await subscribe(store, mailer, "a@b.in", "en", "https://x");
    const token = (await store.findByEmail("a@b.in"))!.token;
    expect(await confirm(store, "nope")).toEqual({ outcome: "invalid", locale: "en" });
    expect(await confirm(store, token)).toEqual({ outcome: "confirmed", locale: "en" });
    expect((await store.listConfirmed()).map((s) => s.email)).toEqual(["a@b.in"]);
    expect(await unsubscribe(store, token)).toEqual({ outcome: "unsubscribed", locale: "en" });
    expect(await store.listConfirmed()).toHaveLength(0);
  });

  it("does not re-email a confirmed address and rejects invalid input", async () => {
    const store = new MemoryStore();
    const { mailer, sent } = fakeMailer();
    await subscribe(store, mailer, "c@d.in", "en", "https://x");
    await confirm(store, (await store.findByEmail("c@d.in"))!.token);
    expect((await subscribe(store, mailer, "c@d.in", "en", "https://x")).outcome).toBe("alreadyConfirmed");
    expect(sent).toHaveLength(1);
    expect((await subscribe(store, mailer, "not-an-email", "en", "https://x")).outcome).toBe("invalid");
    expect((await subscribe(store, mailer, 42, "en", "https://x")).outcome).toBe("invalid");
  });

  it("rate limits bursts from one key", () => {
    const allow = makeRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 1)).toBe(true);
    expect(allow("ip", 2)).toBe(false);
    expect(allow("ip", 1500)).toBe(true);
  });

  it("renders the confirmation email in the subscriber's language", () => {
    const m = confirmationEmail({ email: "e@f.in", locale: "ta", status: "pending", token: "t".repeat(48), createdAt: "" }, "https://x/confirm");
    expect(m.subject).toContain("My Money & Me");
    expect(m.html).toContain("https://x/confirm");
    expect(m.text).toContain("உறுதிப்படுத்து");
  });
});
