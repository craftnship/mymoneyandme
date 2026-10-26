import { z } from "zod";
import type { Article, Block, Chapter, NewsItem, Translation } from "./types";
import { isArticleCategory } from "./categories";

/**
 * Validation for what the authoring console saves. The shapes mirror
 * ./types.ts; anything the public renderer would choke on is refused here,
 * before it reaches the database.
 */
const text = z.string().max(20000);
/** Images ship with the code (/images) or were uploaded in the console (/media). */
const IMAGE_PATH = z.string().regex(/^\/(images|media)\/[\w./-]+$/).max(200);
const line = z.string().max(500);

export const blockSchema: z.ZodType<Block> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: line }),
  z.object({ type: z.literal("paragraph"), text }),
  z.object({ type: z.literal("list"), ordered: z.boolean().optional(), items: z.array(text).max(100) }),
  z.object({ type: z.literal("callout"), tone: z.enum(["info", "tip", "warning"]), text }),
  z.object({ type: z.literal("quote"), text, cite: line.optional() }),
  z.object({ type: z.literal("table"), header: z.array(line).min(1).max(12), rows: z.array(z.array(text).max(12)).max(200) }),
  z.object({ type: z.literal("calculator"), slug: z.string().regex(/^[a-z0-9-]+$/).max(80) }),
  z.object({ type: z.literal("takeaways"), items: z.array(text).max(50) }),
  z.object({ type: z.literal("glossary"), terms: z.array(z.object({ term: line, definition: text })).max(100) }),
  z.object({
    type: z.literal("quiz"),
    questions: z.array(z.object({ q: text, options: z.array(line).min(2).max(8), answer: z.number().int().min(0), explanation: text.optional() })).max(50),
  }),
  z.object({ type: z.literal("activity"), text }),
  z.object({ type: z.literal("faq"), items: z.array(z.object({ q: line, a: text })).max(50) }),
  // An empty src is a draft that has no image yet; publishProblems refuses it.
  z.object({ type: z.literal("image"), src: z.union([z.literal(""), IMAGE_PATH]), alt: line, caption: line.optional() }),
]) as z.ZodType<Block>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const translationSchema: z.ZodType<Translation> = z.object({
  locale: z.string().regex(/^[a-z]{2}$/),
  title: line,
  excerpt: z.string().max(1000),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(150).optional(),
  seoTitle: line.optional(),
  seoDescription: z.string().max(500).optional(),
  blocks: z.array(blockSchema).max(400),
  state: z.enum(["draft", "inReview", "approved", "published"]),
  aiDraft: z.boolean(),
  outOfDate: z.boolean().optional(),
  publishAt: z.string().datetime({ offset: true }).optional(),
  publishedAt: date.optional(),
  updatedAt: date.optional(),
}) as z.ZodType<Translation>;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const articleSchema: z.ZodType<Article> = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  slug: z.string().regex(SLUG_PATTERN).max(150),
  sourceLocale: z.string().regex(/^[a-z]{2}$/),
  category: z.string().refine(isArticleCategory),
  format: z.enum(["explainer", "news", "howTo", "story"]),
  tags: z.array(z.string().max(60)).max(20),
  author: z.string().min(1).max(100),
  publishedAt: date,
  updatedAt: date.optional(),
  pinned: z.boolean().optional(),
  cover: IMAGE_PATH.optional(),
  relatedCalculator: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  relatedChapter: z.string().regex(/^(adults|kids|women)\/[a-z0-9-]+\/[a-z0-9-]+$/).max(200).optional(),
  translations: z.array(translationSchema).min(1).max(12),
}) as z.ZodType<Article>;

export const chapterSchema: z.ZodType<Chapter> = z.object({
  slug: z.string().regex(SLUG_PATTERN).max(100),
  readingMinutes: z.number().int().min(1).max(240),
  translations: z.array(translationSchema).min(1).max(12),
}) as z.ZodType<Chapter>;

const shortText = z.object({ locale: z.string().regex(/^[a-z]{2}$/), title: z.string().trim().min(1).max(300), summary: z.string().trim().min(1).max(1000) });

/** What the module page edits; the rest of a module (order, prerequisites, check-up link) is kept as it is. */
export const moduleEditSchema = z.object({
  track: z.enum(["adults", "kids", "women"]),
  slug: z.string().regex(SLUG_PATTERN).max(100),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedHours: z.number().min(0.5).max(200),
  translations: z.array(shortText).min(1).max(12),
  chapterOrder: z.array(z.string().regex(SLUG_PATTERN).max(100)).max(100),
});
export type ModuleEdit = z.infer<typeof moduleEditSchema>;

export const newsSchema: z.ZodType<NewsItem> = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  date,
  category: z.string().refine(isArticleCategory),
  source: z.object({ name: z.string().trim().min(1).max(100), url: z.string().url().max(500).regex(/^https?:\/\//) }),
  translations: z.array(shortText).min(1).max(12),
}) as z.ZodType<NewsItem>;

/** Every piece of reader-facing text in a block, for the "nothing left empty" check. */
export function blockTexts(b: Block): string[] {
  switch (b.type) {
    case "heading": case "paragraph": case "callout": case "activity": return [b.text];
    case "quote": return [b.text];
    case "list": case "takeaways": return b.items;
    case "table": return [...b.header, ...b.rows.flat()];
    case "glossary": return b.terms.flatMap((t) => [t.term, t.definition]);
    case "quiz": return b.questions.flatMap((q) => [q.q, ...q.options]);
    case "faq": return b.items.flatMap((i) => [i.q, i.a]);
    case "calculator": return [];
    case "image": return b.caption !== undefined ? [b.alt, b.caption] : [b.alt];
  }
}

export type Problem =
  | { code: "titleMissing" | "excerptMissing" | "noBlocks"; locale: string }
  | { code: "emptyText" | "quizAnswer" | "unknownCalculator" | "imageMissing" | "structureDiffers"; locale: string; block: number };

/**
 * What stops a translation from being published: an empty title, excerpt or
 * body, a block with empty text, a quiz answer outside its options, an
 * unknown calculator, or a block that no longer mirrors the source (quizzes,
 * calculators and placeholders line up only when every language has the
 * same blocks in the same order). Drafts are saved regardless.
 */
export function publishProblems(t: Translation, source: Translation | undefined, calculators: Set<string>): Problem[] {
  const out: Problem[] = [];
  if (!t.title.trim()) out.push({ code: "titleMissing", locale: t.locale });
  if (!t.excerpt.trim()) out.push({ code: "excerptMissing", locale: t.locale });
  if (t.blocks.length === 0) out.push({ code: "noBlocks", locale: t.locale });
  t.blocks.forEach((b, i) => {
    if (blockTexts(b).some((s) => !s.trim()) || (b.type !== "calculator" && blockTexts(b).length === 0)) out.push({ code: "emptyText", locale: t.locale, block: i });
    if (b.type === "quiz" && b.questions.some((q) => q.answer >= q.options.length)) out.push({ code: "quizAnswer", locale: t.locale, block: i });
    if (b.type === "calculator" && !calculators.has(b.slug)) out.push({ code: "unknownCalculator", locale: t.locale, block: i });
    if (b.type === "image" && !b.src) out.push({ code: "imageMissing", locale: t.locale, block: i });
  });
  if (source && source !== t) {
    const n = Math.max(source.blocks.length, t.blocks.length);
    for (let i = 0; i < n; i++) {
      const a = source.blocks[i];
      const b = t.blocks[i];
      if (!a || !b || a.type !== b.type) out.push({ code: "structureDiffers", locale: t.locale, block: i });
    }
  }
  return out;
}
