"use server";

import { updateTag } from "next/cache";
import { routing } from "@/i18n/routing";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/admin";
import { audit } from "@/lib/auth/users";
import { databaseConfigured, newId } from "@/lib/db";
import { CALCULATORS } from "@/lib/calculators";
import { saveImage, type UploadError } from "@/lib/media/store";
import { archiveItem, articleForEdit, chapterExists, chapterForEdit, moduleForEdit, newsForEdit, saveArticle, saveChapter, saveModule, saveNews, slugTaken } from "./admin";
import { markOutOfDate, stampPublishDates, stampTranslationDates } from "./editing";
import { itemId } from "./rows";
import { articleSchema, chapterSchema, moduleEditSchema, newsSchema, publishProblems, type Problem } from "./schema";
import { CONTENT_TAG } from "./store";
import type { Track } from "./types";

const localeSchema = z.string().regex(/^[a-z]{2}$/);
const trackSchema = z.enum(["adults", "kids", "women"]);
const slugSchema = z.string().regex(/^[a-z0-9-]+$/).max(100);
const CALC_SLUGS = new Set(CALCULATORS.map((c) => c.slug));

export type SaveResult =
  | { ok: true; id: string; savedAt: string; refresh: string[] }
  | { ok: false; error: "invalid" | "slugTaken" | "notConfigured" | "forbidden" | "failed" | "notFound"; problems?: Problem[] };

type Fail = Extract<SaveResult, { ok: false }>;

/** The signed-in staff member, or the error every action returns without one. */
async function staffOrFail(locale: string): Promise<{ id: string } | Fail> {
  try {
    return (await requireStaff(localeSchema.parse(locale))).user;
  } catch {
    return { ok: false, error: "forbidden" };
  }
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

/** Expires the public content cache and hands back the pages the editor should request once (see pagesToRefresh). */
function published(id: string, paths: string[]): SaveResult {
  updateTag(CONTENT_TAG);
  return { ok: true, id, savedAt: new Date().toISOString(), refresh: paths };
}

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
    article = markOutOfDate(before, article);
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

const LOCALES = routing.locales as readonly string[];

function learnPages(track: string, moduleSlug: string, chapterSlug?: string): string[] {
  return [
    ...LOCALES.map((l) => `/${l}/learn/${track}/${moduleSlug}`),
    ...LOCALES.map((l) => `/${l}/learn/${track}`),
    ...LOCALES.map((l) => `/${l}/learn`),
    ...(chapterSlug ? LOCALES.map((l) => `/${l}/learn/${track}/${moduleSlug}/${chapterSlug}`) : []),
  ];
}

/**
 * Saves a chapter. A language set to published must pass publishProblems,
 * with the default language as the source. New chapters go to the end of
 * the module; their address can't change afterwards.
 */
export async function saveChapterAction(locale: string, track: string, moduleSlug: string, payload: string, isNew: boolean): Promise<SaveResult> {
  const staff = await staffOrFail(locale);
  if ("ok" in staff) return staff;
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };
  const t = trackSchema.safeParse(track);
  const m = slugSchema.safeParse(moduleSlug);
  const parsed = chapterSchema.safeParse(parsePayload(payload));
  if (!t.success || !m.success || !parsed.success) return { ok: false, error: "invalid" };
  const mod = await moduleForEdit(t.data as Track, m.data);
  if (!mod) return { ok: false, error: "notFound" };
  const exists = mod.chapters.some((c) => c.slug === parsed.data.slug);
  if (isNew ? exists || (await chapterExists(mod, parsed.data.slug)) : !exists) return { ok: false, error: isNew ? "slugTaken" : "notFound" };

  const before = mod.chapters.find((c) => c.slug === parsed.data.slug);
  const sourceLocale = routing.defaultLocale;
  const marked = markOutOfDate(before && { ...before, sourceLocale }, { ...parsed.data, sourceLocale });
  const chapter = { slug: marked.slug, readingMinutes: marked.readingMinutes, translations: stampTranslationDates(marked.translations, todayInIndia()) };
  const source = chapter.translations.find((x) => x.locale === routing.defaultLocale) ?? chapter.translations[0];
  const problems = chapter.translations.filter((x) => x.state === "published").flatMap((x) => publishProblems(x, source, CALC_SLUGS));
  if (problems.length > 0) return { ok: false, error: "invalid", problems };
  try {
    await saveChapter(mod, chapter, staff.id);
    await audit(staff.id, isNew ? "chapterCreated" : "chapterSaved", "chapter", itemId.chapter(mod, chapter));
  } catch (e) {
    console.error("Saving chapter failed", e);
    return { ok: false, error: "failed" };
  }
  return published(chapter.slug, learnPages(mod.track, mod.slug, chapter.slug));
}

/** Saves a module's titles, summaries, difficulty, hours and chapter order. */
export async function saveModuleAction(locale: string, payload: string): Promise<SaveResult> {
  const staff = await staffOrFail(locale);
  if ("ok" in staff) return staff;
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };
  const parsed = moduleEditSchema.safeParse(parsePayload(payload));
  if (!parsed.success || !parsed.data.translations.some((x) => x.locale === routing.defaultLocale)) return { ok: false, error: "invalid" };
  const edit = parsed.data;
  const mod = await moduleForEdit(edit.track, edit.slug);
  if (!mod) return { ok: false, error: "notFound" };
  // The order must name every chapter exactly once; anything else means the page is out of date.
  const current = mod.chapters.map((c) => c.slug).sort();
  if (edit.chapterOrder.length !== current.length || [...edit.chapterOrder].sort().some((s, i) => s !== current[i])) return { ok: false, error: "failed" };
  try {
    await saveModule(mod, edit, staff.id);
    await audit(staff.id, "moduleSaved", "module", itemId.module(mod));
  } catch (e) {
    console.error("Saving module failed", e);
    return { ok: false, error: "failed" };
  }
  return published(mod.slug, [...learnPages(mod.track, mod.slug), ...LOCALES.flatMap((l) => mod.chapters.map((c) => `/${l}/learn/${mod.track}/${mod.slug}/${c.slug}`))]);
}

const newsPages = () => [...LOCALES.map((l) => `/${l}`), ...LOCALES.map((l) => `/${l}/newsletter`)];

/** Saves a news item. News has no workflow: every language it carries is live. */
export async function saveNewsAction(locale: string, payload: string, isNew: boolean): Promise<SaveResult> {
  const staff = await staffOrFail(locale);
  if ("ok" in staff) return staff;
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };
  const parsed = newsSchema.safeParse(parsePayload(payload));
  if (!parsed.success || !parsed.data.translations.some((x) => x.locale === routing.defaultLocale)) return { ok: false, error: "invalid" };
  const item = isNew ? { ...parsed.data, id: `news-${newId().slice(0, 8)}` } : parsed.data;
  if (!isNew && !(await newsForEdit(item.id))) return { ok: false, error: "notFound" };
  try {
    await saveNews(item, staff.id);
    await audit(staff.id, isNew ? "newsCreated" : "newsSaved", "news", item.id);
  } catch (e) {
    console.error("Saving news failed", e);
    return { ok: false, error: "failed" };
  }
  return published(item.id, newsPages());
}

/**
 * Takes a news item or a chapter off the site. A chapter can only go while
 * no language of it is published, so a link readers may have is never
 * broken by accident: unpublish it first.
 */
export async function removeItemAction(locale: string, kind: "news" | "chapter", ref: { id?: string; track?: string; module?: string; chapter?: string }): Promise<SaveResult> {
  const staff = await staffOrFail(locale);
  if ("ok" in staff) return staff;
  if (!databaseConfigured()) return { ok: false, error: "notConfigured" };
  try {
    if (kind === "news") {
      const id = slugSchema.safeParse(ref.id);
      if (!id.success || !(await newsForEdit(id.data))) return { ok: false, error: "notFound" };
      await archiveItem(itemId.news({ id: id.data }), staff.id);
      await audit(staff.id, "newsRemoved", "news", id.data);
      return published(id.data, newsPages());
    }
    const t = trackSchema.safeParse(ref.track);
    const m = slugSchema.safeParse(ref.module);
    const c = slugSchema.safeParse(ref.chapter);
    if (!t.success || !m.success || !c.success) return { ok: false, error: "invalid" };
    const hit = await chapterForEdit(t.data as Track, m.data, c.data);
    if (!hit) return { ok: false, error: "notFound" };
    if (hit.chapter.translations.some((x) => x.state === "published")) return { ok: false, error: "invalid" };
    const key = itemId.chapter(hit.module, hit.chapter);
    await archiveItem(key, staff.id);
    await audit(staff.id, "chapterRemoved", "chapter", key);
    return published(c.data, learnPages(hit.module.track, hit.module.slug));
  } catch (e) {
    console.error("Removing item failed", e);
    return { ok: false, error: "failed" };
  }
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
