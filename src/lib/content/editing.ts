import type { Article, Block, Translation } from "./types";

/**
 * Pure editing operations for the authoring console. Structure (which blocks,
 * in which order, and the fields every language shares: heading level, list
 * numbering, callout tone, calculator, table width, quiz answers) changes in
 * every language at once, so translations always mirror the source block by
 * block. Text changes only in the language being edited.
 */
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

function mapAll(article: Article, fn: (blocks: Block[], t: Translation) => Block[]): Article {
  return { ...article, translations: article.translations.map((t) => ({ ...t, blocks: fn(t.blocks, t) })) };
}

export function insertBlock(article: Article, index: number, block: Block): Article {
  return mapAll(article, (blocks, t) => {
    const copy = t.locale === article.sourceLocale ? block : blankCopy(block);
    return [...blocks.slice(0, index), copy, ...blocks.slice(index)];
  });
}

export function removeBlock(article: Article, index: number): Article {
  return mapAll(article, (blocks) => blocks.filter((_, i) => i !== index));
}

export function moveBlock(article: Article, index: number, delta: -1 | 1): Article {
  const to = index + delta;
  return mapAll(article, (blocks) => {
    if (to < 0 || to >= blocks.length) return blocks;
    const next = [...blocks];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });
}

/** Replaces one language's copy of a block; text edits. */
export function setBlockText(article: Article, locale: string, index: number, block: Block): Article {
  return { ...article, translations: article.translations.map((t) => (t.locale === locale ? { ...t, blocks: t.blocks.map((b, i) => (i === index ? block : b)) } : t)) };
}

/**
 * Applies a structural change to the block at `index` in every language:
 * `change` receives each language's copy and returns the changed copy, so a
 * new table row or quiz option appears (empty) everywhere.
 */
export function setBlockShared(article: Article, index: number, change: (b: Block, isSource: boolean) => Block): Article {
  return mapAll(article, (blocks, t) => blocks.map((b, i) => (i === index ? change(b, t.locale === article.sourceLocale) : b)));
}

/** Starts a translation with the source's structure and empty text. */
export function addTranslation(article: Article, locale: string): Article {
  if (article.translations.some((t) => t.locale === locale)) return article;
  const source = article.translations.find((t) => t.locale === article.sourceLocale) ?? article.translations[0];
  const t: Translation = { locale, title: "", excerpt: "", blocks: (source?.blocks ?? []).map(blankCopy), state: "draft", aiDraft: false };
  return { ...article, translations: [...article.translations, t] };
}

export function patchTranslation(article: Article, locale: string, patch: Partial<Translation>): Article {
  return { ...article, translations: article.translations.map((t) => (t.locale === locale ? { ...t, ...patch } : t)) };
}

/**
 * Dates that follow from the states: a language published for the first time
 * gets today's date, and the article's own date (which orders the feed) is
 * its earliest published language.
 */
export function stampPublishDates(article: Article, today: string): Article {
  const translations = article.translations.map((t) => (t.state === "published" && !t.publishedAt ? { ...t, publishedAt: today } : t));
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
