import type { Article, Block, Chapter, NewsItem, Translation } from "./types";
import { blockTexts } from "./schema";

/**
 * Pure editing operations for the authoring console. Structure (which blocks,
 * in which order, and the fields every language shares: heading level, list
 * numbering, callout tone, calculator, table width, quiz answers) changes in
 * every language at once, so translations always mirror the source block by
 * block. Text changes only in the language being edited. The operations work
 * on anything with a source language and full translations: articles, and
 * chapters (whose source is always the default language).
 */
export type Doc = { sourceLocale: string; translations: Translation[] };

export type BlockType = Block["type"];

export const BLOCK_TYPES: BlockType[] = ["paragraph", "heading", "list", "callout", "quote", "table", "calculator", "takeaways", "faq", "glossary", "quiz", "activity"];

export function newBlock(type: BlockType, calculator = "sip"): Block {
  switch (type) {
    case "heading": return { type, level: 2, text: "" };
    case "paragraph": return { type, text: "" };
    case "list": return { type, items: [""] };
    case "callout": return { type, tone: "tip", text: "" };
    case "quote": return { type, text: "" };
    case "table": return { type, header: ["", ""], rows: [["", ""]] };
    case "calculator": return { type, slug: calculator };
    case "takeaways": return { type, items: [""] };
    case "glossary": return { type, terms: [{ term: "", definition: "" }] };
    case "quiz": return { type, questions: [{ q: "", options: ["", ""], answer: 0 }] };
    case "activity": return { type, text: "" };
    case "faq": return { type, items: [{ q: "", a: "" }] };
  }
}

/** The same block with every text emptied, for a language that has not translated it yet. */
export function blankCopy(b: Block): Block {
  switch (b.type) {
    case "heading": case "paragraph": case "callout": case "activity": return { ...b, text: "" };
    case "quote": return { ...b, text: "", cite: b.cite ? "" : undefined };
    case "list": case "takeaways": return { ...b, items: b.items.map(() => "") };
    case "table": return { ...b, header: b.header.map(() => ""), rows: b.rows.map((r) => r.map(() => "")) };
    case "glossary": return { ...b, terms: b.terms.map(() => ({ term: "", definition: "" })) };
    case "quiz": return { ...b, questions: b.questions.map((q) => ({ q: "", options: q.options.map(() => ""), answer: q.answer, ...(q.explanation !== undefined ? { explanation: "" } : {}) })) };
    case "faq": return { ...b, items: b.items.map(() => ({ q: "", a: "" })) };
    case "calculator": return { ...b };
  }
}

function mapAll<D extends Doc>(article: D, fn: (blocks: Block[], t: Translation) => Block[]): D {
  return { ...article, translations: article.translations.map((t) => ({ ...t, blocks: fn(t.blocks, t) })) };
}

export function insertBlock<D extends Doc>(article: D, index: number, block: Block): D {
  return mapAll(article, (blocks, t) => {
    const copy = t.locale === article.sourceLocale ? block : blankCopy(block);
    return [...blocks.slice(0, index), copy, ...blocks.slice(index)];
  });
}

export function removeBlock<D extends Doc>(article: D, index: number): D {
  return mapAll(article, (blocks) => blocks.filter((_, i) => i !== index));
}

export function moveBlock<D extends Doc>(article: D, index: number, delta: -1 | 1): D {
  const to = index + delta;
  return mapAll(article, (blocks) => {
    if (to < 0 || to >= blocks.length) return blocks;
    const next = [...blocks];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });
}

/** Replaces one language's copy of a block; text edits. */
export function setBlockText<D extends Doc>(article: D, locale: string, index: number, block: Block): D {
  return { ...article, translations: article.translations.map((t) => (t.locale === locale ? { ...t, blocks: t.blocks.map((b, i) => (i === index ? block : b)) } : t)) };
}

/**
 * Applies a structural change to the block at `index` in every language:
 * `change` receives each language's copy and returns the changed copy, so a
 * new table row or quiz option appears (empty) everywhere.
 */
export function setBlockShared<D extends Doc>(article: D, index: number, change: (b: Block, isSource: boolean) => Block): D {
  return mapAll(article, (blocks, t) => blocks.map((b, i) => (i === index ? change(b, t.locale === article.sourceLocale) : b)));
}

/** Starts a translation with the source's structure and empty text. */
export function addTranslation<D extends Doc>(article: D, locale: string): D {
  if (article.translations.some((t) => t.locale === locale)) return article;
  const source = article.translations.find((t) => t.locale === article.sourceLocale) ?? article.translations[0];
  const t: Translation = { locale, title: "", excerpt: "", blocks: (source?.blocks ?? []).map(blankCopy), state: "draft", aiDraft: false };
  return { ...article, translations: [...article.translations, t] };
}

export function patchTranslation<D extends Doc>(article: D, locale: string, patch: Partial<Translation>): D {
  return { ...article, translations: article.translations.map((t) => (t.locale === locale ? { ...t, ...patch } : t)) };
}

/**
 * Dates that follow from the states: a language published for the first time
 * gets today's date, and the article's own date (which orders the feed) is
 * its earliest published language.
 */
export function stampTranslationDates(translations: Translation[], today: string): Translation[] {
  return translations.map((t) => (t.state === "published" && !t.publishedAt ? { ...t, publishedAt: today } : t));
}

export function stampPublishDates(article: Article, today: string): Article {
  const translations = stampTranslationDates(article.translations, today);
  const dates = translations.filter((t) => t.state === "published" && t.publishedAt).map((t) => t.publishedAt!).sort();
  return { ...article, translations, publishedAt: dates[0] ?? article.publishedAt };
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export function emptyArticle(id: string, today: string, sourceLocale = "en"): Article {
  return {
    id,
    slug: "",
    sourceLocale,
    category: "personalFinance",
    format: "explainer",
    tags: [],
    author: "My Money & Me",
    publishedAt: today,
    translations: [{ locale: sourceLocale, title: "", excerpt: "", blocks: [newBlock("paragraph")], state: "draft", aiDraft: false }],
  };
}

/** A chapter as the editor holds it: chapters have no source field of their own, so the default language is the source. */
export type ChapterDoc = Chapter & { sourceLocale: string };

export function emptyChapter(slug: string, title: string, sourceLocale = "en"): Chapter {
  return { slug, readingMinutes: 5, translations: [{ locale: sourceLocale, title, excerpt: "", blocks: [newBlock("paragraph")], state: "draft", aiDraft: false }] };
}

export function emptyNews(id: string, today: string, sourceLocale = "en"): NewsItem {
  return { id, date: today, category: "economy", source: { name: "", url: "" }, translations: [{ locale: sourceLocale, title: "", summary: "" }] };
}

/** Moves the item at `index` one place up or down; anything else returns the list unchanged. */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Reading time at 200 words a minute over every block's text, at least one minute. */
export function estimateMinutes(t: Translation): number {
  const words = t.blocks.flatMap(blockTexts).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
