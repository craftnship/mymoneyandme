import { createHash } from "node:crypto";
import { sortSnapshot, type ContentSnapshot } from "./json";
import type { Article, Chapter, Module, NewsItem, Translation, TranslationState } from "./types";

/**
 * Mapping between the content model and the database tables (migration
 * 0005_content). One `content_items` row per article, module, chapter or news
 * item holds its settings as JSON; one `content_translations` row per language
 * holds the full translation as JSON plus the columns the admin lists and
 * filters on. `fromRows(toRows(x))` returns `x`, which the tests check for
 * every file under /content.
 */
export type ItemKind = "article" | "module" | "chapter" | "news";
export type ItemOrigin = "json" | "admin";

export type ItemRow = {
  id: string;
  kind: ItemKind;
  slug: string;
  parentId: string | null;
  position: number;
  settings: string;
  jsonHash: string;
};

export type TranslationRow = {
  itemId: string;
  locale: string;
  title: string;
  summary: string;
  state: TranslationState;
  aiDraft: boolean;
  publishedAt: string | null;
  body: string;
};

export type ContentRows = { items: ItemRow[]; translations: TranslationRow[] };

type ShortTranslation = { locale: string; title: string; summary: string };

export const itemId = {
  article: (a: Pick<Article, "id">) => `article:${a.id}`,
  module: (m: Pick<Module, "track" | "slug">) => `module:${m.track}/${m.slug}`,
  chapter: (m: Pick<Module, "track" | "slug">, c: Pick<Chapter, "slug">) => `chapter:${m.track}/${m.slug}/${c.slug}`,
  news: (n: Pick<NewsItem, "id">) => `news:${n.id}`,
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function fullTranslation(id: string, t: Translation): TranslationRow {
  return { itemId: id, locale: t.locale, title: t.title, summary: t.excerpt, state: t.state, aiDraft: t.aiDraft, publishedAt: t.publishedAt ?? null, body: JSON.stringify(t) };
}

/** Module titles and news items have no workflow of their own: they count as published in every language they carry. */
function shortTranslation(id: string, t: ShortTranslation): TranslationRow {
  return { itemId: id, locale: t.locale, title: t.title, summary: t.summary, state: "published", aiDraft: false, publishedAt: null, body: JSON.stringify(t) };
}

export function toRows(s: ContentSnapshot): ContentRows {
  const items: ItemRow[] = [];
  const translations: TranslationRow[] = [];

  for (const a of s.articles) {
    const { translations: ts, ...settings } = a;
    const id = itemId.article(a);
    items.push({ id, kind: "article", slug: a.slug, parentId: null, position: 0, settings: JSON.stringify(settings), jsonHash: hash(a) });
    translations.push(...ts.map((t) => fullTranslation(id, t)));
  }

  for (const m of s.modules) {
    const { translations: ts, chapters, ...settings } = m;
    const id = itemId.module(m);
    items.push({ id, kind: "module", slug: m.slug, parentId: null, position: m.order, settings: JSON.stringify(settings), jsonHash: hash({ settings, ts }) });
    translations.push(...ts.map((t) => shortTranslation(id, t)));
    chapters.forEach((c, i) => {
      const { translations: cts, ...cSettings } = c;
      const cid = itemId.chapter(m, c);
      items.push({ id: cid, kind: "chapter", slug: c.slug, parentId: id, position: i, settings: JSON.stringify(cSettings), jsonHash: hash({ c, i }) });
      translations.push(...cts.map((t) => fullTranslation(cid, t)));
    });
  }

  for (const n of s.news) {
    const { translations: ts, ...settings } = n;
    const id = itemId.news(n);
    items.push({ id, kind: "news", slug: n.id, parentId: null, position: 0, settings: JSON.stringify(settings), jsonHash: hash(n) });
    translations.push(...ts.map((t) => shortTranslation(id, t)));
  }

  return { items, translations };
}

/** The source language first, then the rest alphabetically, so fallbacks that take the first translation stay stable. */
function orderTranslations<T extends { locale: string }>(ts: T[], source: string): T[] {
  return [...ts].sort((a, b) => (a.locale === source ? -1 : b.locale === source ? 1 : a.locale.localeCompare(b.locale)));
}

export function fromRows(rows: ContentRows, defaultLocale = "en"): ContentSnapshot {
  const byItem = new Map<string, TranslationRow[]>();
  for (const t of rows.translations) {
    const list = byItem.get(t.itemId);
    if (list) list.push(t);
    else byItem.set(t.itemId, [t]);
  }
  const bodies = <T extends { locale: string }>(id: string, source: string) =>
    orderTranslations((byItem.get(id) ?? []).map((t) => JSON.parse(t.body) as T), source);

  const articles: Article[] = [];
  const modules: Module[] = [];
  const news: NewsItem[] = [];
  const chaptersByModule = new Map<string, { position: number; chapter: Chapter }[]>();

  for (const item of rows.items) {
    const settings = JSON.parse(item.settings);
    if (item.kind === "chapter" && item.parentId) {
      const list = chaptersByModule.get(item.parentId) ?? [];
      list.push({ position: item.position, chapter: { ...settings, translations: bodies<Translation>(item.id, defaultLocale) } });
      chaptersByModule.set(item.parentId, list);
    }
  }

  for (const item of rows.items) {
    const settings = JSON.parse(item.settings);
    if (item.kind === "article") {
      articles.push({ ...settings, translations: bodies<Translation>(item.id, settings.sourceLocale ?? defaultLocale) });
    } else if (item.kind === "module") {
      const chapters = (chaptersByModule.get(item.id) ?? []).sort((a, b) => a.position - b.position).map((c) => c.chapter);
      modules.push({ ...settings, translations: bodies<ShortTranslation>(item.id, defaultLocale), chapters });
    } else if (item.kind === "news") {
      news.push({ ...settings, translations: bodies<ShortTranslation>(item.id, defaultLocale) });
    }
  }

  return sortSnapshot({ articles, modules, news });
}
