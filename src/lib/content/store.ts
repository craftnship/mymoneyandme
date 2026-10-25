import fs from "node:fs";
import path from "node:path";
import type { Article, Chapter, Module, NewsItem, Track, Translation } from "./types";
import { routing } from "@/i18n/routing";

const ROOT = path.join(process.cwd(), "content");

function readJsonDir<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T);
}

let articleCache: Article[] | null = null;
let moduleCache: Module[] | null = null;

export function allArticles(): Article[] {
  if (!articleCache || process.env.NODE_ENV !== "production") {
    articleCache = readJsonDir<Article>(path.join(ROOT, "articles")).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
  return articleCache;
}

let newsCache: NewsItem[] | null = null;

/** Newest first. */
export function allNews(): NewsItem[] {
  if (!newsCache || process.env.NODE_ENV !== "production") {
    const file = path.join(ROOT, "news.json");
    const items = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as NewsItem[]) : [];
    newsCache = items.sort((a, b) => b.date.localeCompare(a.date));
  }
  return newsCache;
}

export function newsText(item: NewsItem, locale: string) {
  return item.translations.find((t) => t.locale === locale) ?? item.translations.find((t) => t.locale === routing.defaultLocale) ?? item.translations[0];
}

export const DEFAULT_COVER = "/images/articles/default.svg";

export function allModules(): Module[] {
  if (!moduleCache || process.env.NODE_ENV !== "production") {
    const tracks: Track[] = ["adults", "kids", "women"];
    moduleCache = tracks.flatMap((t) => readJsonDir<Module>(path.join(ROOT, "modules", t))).sort((a, b) => a.order - b.order);
  }
  return moduleCache;
}

export function getArticle(slug: string) {
  return allArticles().find((a) => a.slug === slug || a.translations.some((t) => t.slug === slug));
}

export function modulesForTrack(track: Track) {
  return allModules().filter((m) => m.track === track);
}

export function getModule(track: Track, slug: string) {
  return allModules().find((m) => m.track === track && m.slug === slug);
}

export function getChapter(track: Track, moduleSlug: string, chapterSlug: string): { module: Module; chapter: Chapter; index: number } | undefined {
  const mod = getModule(track, moduleSlug);
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
