import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { moduleFullyTranslated, newsText, resolveTranslation } from "./store";
import { readJsonContent } from "./json";
import { searchArticles } from "./search";
import { CALCULATORS } from "@/lib/calculators";
import type { Block, Translation } from "./types";

const BLOCK_TYPES = new Set(["heading", "paragraph", "list", "callout", "quote", "table", "calculator", "takeaways", "glossary", "quiz", "activity", "faq"]);
const PLACEHOLDER_KEYS = new Set([
  "inflation_default", "inflation_education", "return_equity", "return_debt", "section_80c_limit", "section_80d_self",
  "nps_80ccd1b_limit", "standard_deduction_new", "standard_deduction_old", "rebate_87a_limit_new", "ppf_rate", "epf_rate",
  "ssy_rate", "scss_rate", "nsc_rate", "financial_year", "rulepack_version",
]);
const content = readJsonContent();
const allArticles = () => content.articles;
const allModules = () => content.modules;
const allNews = () => content.news;
const CALC_SLUGS = new Set(CALCULATORS.map((c) => c.slug));

function textOf(b: Block): string[] {
  switch (b.type) {
    case "heading": case "paragraph": case "callout": case "quote": case "activity": return [b.text];
    case "list": case "takeaways": return b.items;
    case "table": return [...b.header, ...b.rows.flat()];
    case "glossary": return b.terms.flatMap((t) => [t.term, t.definition]);
    case "quiz": return b.questions.flatMap((q) => [q.q, ...q.options, q.explanation ?? ""]);
    case "faq": return b.items.flatMap((i) => [i.q, i.a]);
    case "calculator": return [];
  }
}

function checkTranslation(where: string, t: Translation) {
  expect(t.title, `${where}: title`).toBeTruthy();
  if (t.state !== "published") return;
  expect(t.excerpt, `${where}: published translation needs an excerpt`).toBeTruthy();
  expect(t.blocks.length, `${where}: published translation needs blocks`).toBeGreaterThan(0);
  for (const b of t.blocks) {
    expect(BLOCK_TYPES.has(b.type), `${where}: unknown block type ${b.type}`).toBe(true);
    if (b.type === "calculator") expect(CALC_SLUGS.has(b.slug), `${where}: unknown calculator ${b.slug}`).toBe(true);
    if (b.type === "quiz") {
      for (const q of b.questions) {
        expect(q.options.length, `${where}: quiz needs 2+ options`).toBeGreaterThanOrEqual(2);
        expect(q.answer, `${where}: quiz answer out of range`).toBeGreaterThanOrEqual(0);
        expect(q.answer, `${where}: quiz answer out of range`).toBeLessThan(q.options.length);
      }
    }
    for (const s of textOf(b)) {
      for (const m of s.matchAll(/\{([a-z0-9_]+)\}/g)) {
        expect(PLACEHOLDER_KEYS.has(m[1]), `${where}: unknown placeholder {${m[1]}}`).toBe(true);
      }
    }
  }
}

/** A translation must mirror the source block by block so quizzes, calculators and placeholders line up. */
function checkMirror(where: string, source: Translation, other: Translation) {
  expect(other.blocks.length, `${where}: ${other.locale} block count differs from ${source.locale}`).toBe(source.blocks.length);
  source.blocks.forEach((sb, i) => {
    const ob = other.blocks[i];
    expect(ob.type, `${where}: block ${i} type differs in ${other.locale}`).toBe(sb.type);
    if (sb.type === "calculator" && ob.type === "calculator") expect(ob.slug).toBe(sb.slug);
    if (sb.type === "quiz" && ob.type === "quiz") {
      expect(ob.questions.length).toBe(sb.questions.length);
      sb.questions.forEach((sq, j) => {
        expect(ob.questions[j].options.length, `${where}: quiz ${j} option count differs in ${other.locale}`).toBe(sq.options.length);
        expect(ob.questions[j].answer, `${where}: quiz ${j} answer differs in ${other.locale}`).toBe(sq.answer);
      });
    }
  });
}

describe("content store", () => {
  it("loads articles with a published English source and valid blocks", () => {
    const articles = allArticles();
    expect(articles.length).toBeGreaterThan(0);
    for (const a of articles) {
      const src = a.translations.find((t) => t.locale === a.sourceLocale);
      expect(src?.state, `${a.slug}: source must be published`).toBe("published");
      for (const t of a.translations) {
        checkTranslation(`article ${a.slug}/${t.locale}`, t);
        if (t !== src && t.state === "published" && src) checkMirror(`article ${a.slug}`, src, t);
      }
      if (a.relatedCalculator) expect(CALC_SLUGS.has(a.relatedCalculator)).toBe(true);
    }
  });

  it("loads modules with valid chapters and mirrored translations", () => {
    const modules = allModules();
    expect(modules.length).toBe(29);
    for (const m of modules) {
      expect(m.translations.some((t) => t.locale === "en")).toBe(true);
      for (const c of m.chapters) {
        const en = c.translations.find((t) => t.locale === "en");
        expect(en, `${m.track}/${m.slug}/${c.slug}: needs English`).toBeTruthy();
        for (const t of c.translations) {
          checkTranslation(`${m.track}/${m.slug}/${c.slug}/${t.locale}`, t);
          if (t.locale !== "en" && t.state === "published") {
            expect(en!.state, `${m.slug}/${c.slug}: translation published before source`).toBe("published");
            checkMirror(`${m.track}/${m.slug}/${c.slug}`, en!, t);
          }
        }
      }
    }
  });

  it("marks the Phase 2 gate modules fully translated into Tamil", () => {
    const gate = ["adults/money-basics", "adults/banking-and-credit", "adults/insurance", "kids/what-is-money", "kids/needs-wants-and-saving", "kids/earning", "women/taking-charge", "women/household-money", "women/career-breaks"];
    for (const key of gate) {
      const [track, slug] = key.split("/");
      const m = allModules().find((x) => x.track === track && x.slug === slug)!;
      expect(m, key).toBeTruthy();
      for (const c of m.chapters) {
        expect(c.translations.find((t) => t.locale === "en")?.state, `${key}/${c.slug} English`).toBe("published");
      }
      expect(moduleFullyTranslated(m, "ta"), `${key} Tamil`).toBe(true);
    }
  });

  it("falls back to the source language when a translation is missing", () => {
    const a = allArticles()[0];
    const r = resolveTranslation(a.translations, "zz");
    expect(r?.fallback).toBe(true);
    expect(r?.locale).toBe(a.sourceLocale);
  });

  it("searches by term and category", () => {
    const all = allArticles();
    expect(searchArticles(all, "en", {})).toHaveLength(all.length);
    expect(searchArticles(all, "en", { q: "budget" }).some((a) => a.slug === "the-50-30-20-budget")).toBe(true);
    expect(searchArticles(all, "ta", { q: "budget" }).some((a) => a.slug === "the-50-30-20-budget")).toBe(true);
    expect(searchArticles(all, "en", { q: "zzzz-no-such-term" })).toHaveLength(0);
    for (const a of searchArticles(all, "en", { category: "loans" })) expect(a.category).toBe("loans");
  });

  it("points every article cover at a file in /public", () => {
    for (const a of allArticles()) {
      if (a.cover) expect(fs.existsSync(path.join(process.cwd(), "public", a.cover)), `${a.slug}: missing cover ${a.cover}`).toBe(true);
    }
  });

  it("loads news newest first, sourced, in English and Tamil", () => {
    const news = allNews();
    expect(news.length).toBeGreaterThan(0);
    expect(new Set(news.map((n) => n.id)).size).toBe(news.length);
    for (let i = 1; i < news.length; i++) expect(news[i - 1].date >= news[i].date).toBe(true);
    for (const n of news) {
      expect(n.date, `${n.id}: date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.source.url, `${n.id}: source`).toMatch(/^https:\/\//);
      for (const locale of ["en", "ta"]) {
        const text = n.translations.find((t) => t.locale === locale);
        expect(text?.title && text.summary, `${n.id}: ${locale} title and summary`).toBeTruthy();
      }
    }
    expect(newsText(news[0], "hi").locale).toBe("en");
  });
});
