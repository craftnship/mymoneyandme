import { cacheLife, cacheTag } from "next/cache";
import type { Article, Chapter, Module, NewsItem, Track, Translation } from "./types";
import { routing } from "@/i18n/routing";
import { loadContent } from "./source";
import type { ContentSnapshot } from "./json";
import { applySchedule } from "./schedule";

/** Cache tag on every content read; the admin clears it when something is published. */
export const CONTENT_TAG = "content";

/**
 * All content, cached across requests. A publish clears the tag at once; the
 * five-minute revalidation is the backstop when a clear does not reach every
 * process. In development the cache only lasts seconds so file edits show up.
 */
async function snapshot(): Promise<ContentSnapshot> {
  "use cache";
  cacheTag(CONTENT_TAG);
  if (process.env.NODE_ENV === "production") cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
  else cacheLife("seconds");
  // Scheduled languages stay hidden until their time; the revalidation above (or the publish cron) brings them in.
  return applySchedule((await loadContent()).snapshot, new Date());
}

/** Newest first. */
export async function allArticles(): Promise<Article[]> {
  return (await snapshot()).articles;
}

/** Newest first. */
export async function allNews(): Promise<NewsItem[]> {
  return (await snapshot()).news;
}

/** In curriculum order. */
export async function allModules(): Promise<Module[]> {
  return (await snapshot()).modules;
}

export function newsText(item: NewsItem, locale: string) {
  return item.translations.find((t) => t.locale === locale) ?? item.translations.find((t) => t.locale === routing.defaultLocale) ?? item.translations[0];
}

export const DEFAULT_COVER = "/images/articles/default.svg";

export async function getArticle(slug: string) {
  return (await allArticles()).find((a) => a.slug === slug || a.translations.some((t) => t.slug === slug));
}

export async function modulesForTrack(track: Track) {
  return (await allModules()).filter((m) => m.track === track);
}

export async function getModule(track: Track, slug: string) {
  return (await allModules()).find((m) => m.track === track && m.slug === slug);
}

export async function getChapter(track: Track, moduleSlug: string, chapterSlug: string): Promise<{ module: Module; chapter: Chapter; index: number } | undefined> {
  const mod = await getModule(track, moduleSlug);
  if (!mod) return undefined;
  const index = mod.chapters.findIndex((c) => c.slug === chapterSlug);
  if (index < 0) return undefined;
  return { module: mod, chapter: mod.chapters[index], index };
}

export type Resolved<T extends Translation = Translation> = {
  translation: T;
  /** The locale actually shown; differs from the requested one on fallback. */
  locale: string;
  fallback: boolean;
};

/**
 * Language fallback (section 12): requested locale → default (source) locale.
 * Only published translations are eligible. Returns `fallback: true` so the UI
 * can show the "not yet translated" banner; fallback events are what the
 * translation backlog is prioritised on.
 */
export function resolveTranslation(translations: Translation[], locale: string): Resolved | undefined {
  const published = translations.filter((t) => t.state === "published");
  const exact = published.find((t) => t.locale === locale);
  if (exact) return { translation: exact, locale, fallback: false };
  const base = published.find((t) => t.locale === routing.defaultLocale) ?? published[0];
  if (!base) return undefined;
  return { translation: base, locale: base.locale, fallback: true };
}

export function availableLocales(translations: Translation[]): string[] {
  return translations.filter((t) => t.state === "published").map((t) => t.locale);
}

export function moduleTitle(module: Module, locale: string) {
  return module.translations.find((t) => t.locale === locale) ?? module.translations.find((t) => t.locale === routing.defaultLocale) ?? module.translations[0];
}

/** Chapters with at least one published translation; the counts the learn pages show so "coming soon" is never counted as ready. */
export function publishedChapters(module: Module): Chapter[] {
  return module.chapters.filter((c) => c.translations.some((t) => t.state === "published"));
}

/** The first readable chapter of a track, in module order: where a visitor who has nothing picked should start. */
export async function firstPublishedChapter(track: Track): Promise<{ module: Module; chapter: Chapter } | undefined> {
  for (const mod of await modulesForTrack(track)) {
    const chapter = publishedChapters(mod)[0];
    if (chapter) return { module: mod, chapter };
  }
  return undefined;
}

/** A module is listed in a language only when all its published chapters exist in it (section 12). */
export function moduleFullyTranslated(module: Module, locale: string) {
  return module.chapters.every((c) => c.translations.some((t) => t.locale === locale && t.state === "published"));
}

export function readingMinutes(translation: Translation) {
  const words = translation.blocks
    .map((b) => ("text" in b ? b.text : "items" in b && Array.isArray(b.items) ? (b.items as unknown[]).map(String).join(" ") : ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
