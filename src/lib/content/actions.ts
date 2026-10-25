"use server";

import { updateTag } from "next/cache";
import { routing } from "@/i18n/routing";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/admin";
import { audit } from "@/lib/auth/users";
import { databaseConfigured, newId } from "@/lib/db";
import { CALCULATORS } from "@/lib/calculators";
import { saveImage, type UploadError } from "@/lib/media/store";
import { articleForEdit, saveArticle, slugTaken } from "./admin";
import { stampPublishDates } from "./editing";
import { articleSchema, publishProblems, type Problem } from "./schema";
import { CONTENT_TAG } from "./store";

const localeSchema = z.string().regex(/^[a-z]{2}$/);
const CALC_SLUGS = new Set(CALCULATORS.map((c) => c.slug));

export type SaveResult =
  | { ok: true; id: string; savedAt: string; refresh: string[] }
  | { ok: false; error: "invalid" | "slugTaken" | "notConfigured" | "forbidden" | "failed"; problems?: Problem[] };

function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Saves an article from the console. Drafts save as they are; a language set
 * to published must pass publishProblems first. Any save clears the public
 * content cache, so a published change is live on the next request.
 */
export async function saveArticleAction(locale: string, payload: string, isNew: boolean): Promise<SaveResult> {
  let staff;
  try {
    staff = await requireStaff(localeSchema.parse(locale));
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { ok: false, error: "invalid" };
  }
  const parsed = articleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  let article = parsed.data;
  let previousSlug: string | undefined;
  if (isNew) article = { ...article, id: `art-${newId().slice(0, 8)}` };
  else {
    const before = await articleForEdit(article.id);
    if (!before) return { ok: false, error: "invalid" };
    previousSlug = before.slug;
  }

  const source = article.translations.find((t) => t.locale === article.sourceLocale);
  if (!source) return { ok: false, error: "invalid" };
  const problems = article.translations.filter((t) => t.state === "published").flatMap((t) => publishProblems(t, source, CALC_SLUGS));
  if (problems.length > 0) return { ok: false, error: "invalid", problems };
  const slugs = [article.slug, ...article.translations.map((t) => t.slug).filter((s): s is string => Boolean(s))];
  for (const s of slugs) if (await slugTaken(s, article.id)) return { ok: false, error: "slugTaken" };

  article = stampPublishDates(article, todayInIndia());
  try {
    await saveArticle(article, staff.user.id);
    await audit(staff.user.id, isNew ? "articleCreated" : "articleSaved", "article", article.id);
  } catch (e) {
    console.error("Saving article failed", e);
    return { ok: false, error: "failed" };
  }
  updateTag(CONTENT_TAG);
  return { ok: true, id: article.id, savedAt: new Date().toISOString(), refresh: pagesToRefresh([article.slug, previousSlug]) };
}

/**
 * Public pages the editor requests once after a save. Expiring the content tag
 * refreshes the cached content at once, but a prerendered page is still served
 * stale to its first visitor while it regenerates; these requests make the
 * editor that visitor instead of a reader. The feeds come first because they
 * render per request and refill the content cache the article pages then use.
 */
function pagesToRefresh(slugs: (string | undefined)[]): string[] {
  const locales = routing.locales as readonly string[];
  const unique = [...new Set(slugs.filter((s): s is string => Boolean(s)))];
  return [...locales.map((l) => `/${l}/articles`), ...locales.map((l) => `/${l}`), ...locales.flatMap((l) => unique.map((s) => `/${l}/articles/${s}`))];
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: UploadError | "forbidden" | "notConfigured" | "failed" };

export async function uploadImageAction(locale: string, form: FormData): Promise<UploadResult> {
  let staff;
  try {
    staff = await requireStaff(localeSchema.parse(locale));
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "empty" };
  try {
    const res = await saveImage(file, staff.user.id);
    if (res.ok) await audit(staff.user.id, "imageUploaded", "media", res.url.slice("/media/".length));
    return res;
  } catch (e) {
    console.error("Image upload failed", e);
    return { ok: false, error: "failed" };
  }
}
