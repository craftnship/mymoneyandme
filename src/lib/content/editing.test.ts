import { describe, expect, it } from "vitest";
import { readJsonContent } from "./json";
import { addTranslation, emptyArticle, emptyChapter, emptyNews, estimateMinutes, insertBlock, moveBlock, moveItem, newBlock, removeBlock, setBlockShared, setBlockText, slugify, stampPublishDates } from "./editing";
import { articleSchema, chapterSchema, moduleEditSchema, newsSchema, publishProblems } from "./schema";
import type { Article } from "./types";

const CALCS = new Set(["sip", "emergency-fund"]);
const types = (a: Article, locale: string) => a.translations.find((t) => t.locale === locale)!.blocks.map((b) => b.type);

describe("editing keeps languages mirrored", () => {
  const base = addTranslation(emptyArticle("art-x", "2026-10-25"), "ta");

  it("starts a translation with the source's blocks and empty text", () => {
    const ta = base.translations.find((t) => t.locale === "ta")!;
    expect(ta.blocks).toEqual([{ type: "paragraph", text: "" }]);
    expect(addTranslation(base, "ta")).toBe(base);
  });

  it("adds, moves and removes blocks in every language", () => {
    let a = insertBlock(base, 1, { type: "heading", level: 2, text: "Why" });
    a = insertBlock(a, 2, newBlock("calculator", "sip"));
    expect(types(a, "en")).toEqual(["paragraph", "heading", "calculator"]);
    expect(types(a, "ta")).toEqual(["paragraph", "heading", "calculator"]);
    expect(a.translations.find((t) => t.locale === "ta")!.blocks[1]).toEqual({ type: "heading", level: 2, text: "" });
    a = moveBlock(a, 2, -1);
    expect(types(a, "ta")).toEqual(["paragraph", "calculator", "heading"]);
    expect(moveBlock(a, 0, -1)).toEqual(a);
    a = removeBlock(a, 1);
    expect(types(a, "en")).toEqual(["paragraph", "heading"]);
    expect(types(a, "ta")).toEqual(["paragraph", "heading"]);
  });

  it("applies shared changes everywhere and text changes to one language", () => {
    let a = insertBlock(base, 1, { type: "table", header: ["A", "B"], rows: [["1", "2"]] });
    a = setBlockShared(a, 1, (b) => (b.type === "table" ? { ...b, rows: [...b.rows, ["", ""]] } : b));
    a = setBlockText(a, "ta", 1, { type: "table", header: ["அ", "ஆ"], rows: [["௧", "௨"], ["", ""]] });
    const en = a.translations.find((t) => t.locale === "en")!.blocks[1];
    const ta = a.translations.find((t) => t.locale === "ta")!.blocks[1];
    expect(en).toEqual({ type: "table", header: ["A", "B"], rows: [["1", "2"], ["", ""]] });
    expect(ta).toEqual({ type: "table", header: ["அ", "ஆ"], rows: [["௧", "௨"], ["", ""]] });
  });

  it("dates a first publish and keeps the feed date on the earliest language", () => {
    const a = { ...base, translations: base.translations.map((t) => ({ ...t, state: t.locale === "en" ? ("published" as const) : t.state, publishedAt: t.locale === "en" ? "2026-10-20" : undefined })) };
    const ta = stampPublishDates({ ...a, translations: a.translations.map((t) => (t.locale === "ta" ? { ...t, state: "published" as const } : t)) }, "2026-10-25");
    expect(ta.translations.find((t) => t.locale === "ta")!.publishedAt).toBe("2026-10-25");
    expect(ta.publishedAt).toBe("2026-10-20");
  });

  it("makes web addresses from titles", () => {
    expect(slugify("How big should your emergency fund be?")).toBe("how-big-should-your-emergency-fund-be");
    expect(slugify("  SIP vs. lump sum: 2026  ")).toBe("sip-vs-lump-sum-2026");
  });
});

describe("article validation", () => {
  it("accepts every article in /content", () => {
    for (const a of readJsonContent().articles) expect(articleSchema.safeParse(a).success, a.slug).toBe(true);
  });

  it("rejects unsafe or malformed fields", () => {
    const a = readJsonContent().articles[0];
    expect(articleSchema.safeParse({ ...a, slug: "Bad Slug" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...a, cover: "javascript:alert(1)" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...a, cover: "https://evil.example/x.png" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...a, cover: "/media/0b9f5c2e-1111-4222-8333-444455556666" }).success).toBe(true);
    expect(articleSchema.safeParse({ ...a, category: "crypto" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...a, translations: [{ ...a.translations[0], blocks: [{ type: "html", text: "<script>" }] }] }).success).toBe(false);
  });

  it("lists what stops a language from being published", () => {
    let a = addTranslation(emptyArticle("art-x", "2026-10-25"), "ta");
    a = insertBlock(a, 1, newBlock("calculator", "nope"));
    const en = a.translations[0];
    expect(publishProblems(en, en, CALCS).map((p) => p.code)).toEqual(["titleMissing", "excerptMissing", "emptyText", "unknownCalculator"]);
    const fixed = { ...en, title: "T", excerpt: "E", blocks: [{ type: "paragraph" as const, text: "Hi" }, { type: "calculator" as const, slug: "sip" }] };
    expect(publishProblems(fixed, fixed, CALCS)).toEqual([]);
    const ta = { ...fixed, locale: "ta", blocks: [{ type: "paragraph" as const, text: "வணக்கம்" }] };
    expect(publishProblems(ta, fixed, CALCS)).toEqual([{ code: "structureDiffers", locale: "ta", block: 1 }]);
  });
});

describe("chapters, modules and news", () => {
  const json = readJsonContent();

  it("edits a chapter with the same mirrored operations, the default language as source", () => {
    let c = addTranslation({ ...emptyChapter("budgets", "Budgets"), sourceLocale: "en" }, "ta");
    c = insertBlock(c, 1, newBlock("quiz"));
    expect(c.translations.map((t) => t.blocks.map((b) => b.type))).toEqual([["paragraph", "quiz"], ["paragraph", "quiz"]]);
    expect(c.slug).toBe("budgets");
  });

  it("accepts every chapter, module and news item in /content", () => {
    for (const m of json.modules) {
      for (const c of m.chapters) expect(chapterSchema.safeParse(c).success, `${m.slug}/${c.slug}`).toBe(true);
      const edit = { track: m.track, slug: m.slug, difficulty: m.difficulty, estimatedHours: m.estimatedHours, translations: m.translations, chapterOrder: m.chapters.map((c) => c.slug) };
      expect(moduleEditSchema.safeParse(edit).success, m.slug).toBe(true);
    }
    for (const n of json.news) expect(newsSchema.safeParse(n).success, n.id).toBe(true);
  });

  it("refuses news without a real source link or text", () => {
    const n = { ...emptyNews("news-x", "2026-10-25"), source: { name: "RBI", url: "https://rbi.org.in/press" }, translations: [{ locale: "en", title: "Repo rate", summary: "Up 0.25%." }] };
    expect(newsSchema.safeParse(n).success).toBe(true);
    expect(newsSchema.safeParse({ ...n, source: { ...n.source, url: "javascript:alert(1)" } }).success).toBe(false);
    expect(newsSchema.safeParse({ ...n, translations: [{ locale: "en", title: " ", summary: "x" }] }).success).toBe(false);
  });

  it("moves list items one place and ignores moves past either end", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("estimates reading time from the text", () => {
    const words = Array.from({ length: 1000 }, () => "word").join(" ");
    expect(estimateMinutes({ ...emptyChapter("x", "X").translations[0], blocks: [{ type: "paragraph", text: words }] })).toBe(5);
    expect(estimateMinutes(emptyChapter("x", "X").translations[0])).toBe(1);
  });
});
