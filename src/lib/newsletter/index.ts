import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Subscriber, SubscriberStore } from "./store";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export type Mailer = {
  sendConfirmation(sub: Subscriber, confirmUrl: string): Promise<void>;
};

export type SubscribeResult = { outcome: "pending" | "alreadyConfirmed" | "invalid" };
export type TokenResult = { outcome: "confirmed" | "unsubscribed" | "invalid"; locale: string };

export function newToken() {
  return randomBytes(24).toString("hex"); // 48 chars, matches the column width
}

/**
 * Double opt-in (section 4). A sign-up is never confirmed by the form alone:
 * the address gets a confirmation link and only that link turns it on. Signing
 * up again re-sends the link with a fresh token; a confirmed address is left
 * alone so the form cannot be used to spam someone who already subscribed.
 */
export async function subscribe(store: SubscriberStore, mailer: Mailer, rawEmail: unknown, locale: string, siteUrl: string): Promise<SubscribeResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { outcome: "invalid" };
  const email = parsed.data;
  const existing = await store.findByEmail(email);
  if (existing?.status === "confirmed") return { outcome: "alreadyConfirmed" };
  const sub: Subscriber = { email, locale, status: "pending", token: newToken(), createdAt: new Date().toISOString() };
  await store.upsertPending(sub);
  await mailer.sendConfirmation(sub, `${siteUrl}/api/newsletter/confirm?token=${sub.token}`);
  return { outcome: "pending" };
}

export async function confirm(store: SubscriberStore, token: string): Promise<TokenResult> {
  const sub = await findByToken(store, token);
  if (!sub) return { outcome: "invalid", locale: "en" };
  if (sub.status !== "confirmed") await store.setStatus(sub.email, "confirmed");
  return { outcome: "confirmed", locale: sub.locale };
}

export async function unsubscribe(store: SubscriberStore, token: string): Promise<TokenResult> {
  const sub = await findByToken(store, token);
  if (!sub) return { outcome: "invalid", locale: "en" };
  await store.setStatus(sub.email, "unsubscribed");
  return { outcome: "unsubscribed", locale: sub.locale };
}

async function findByToken(store: SubscriberStore, token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return undefined;
  return store.findByToken(token);
}

/** Small in-memory limiter for the public sign-up route: a burst from one address is almost always abuse. */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
