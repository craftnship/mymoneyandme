/**
 * Content model (sections 4, 5, 12, 19). One source document fans out into
 * labelled translations that publish independently. The JSON files in
 * /content seed the database (see ./rows.ts and ./db.ts), which the
 * authoring console edits in the same shape.
 */
export type Locale = string;

export type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "callout"; tone: "info" | "tip" | "warning"; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "calculator"; slug: string }
  | { type: "takeaways"; items: string[] }
  | { type: "glossary"; terms: { term: string; definition: string }[] }
  | { type: "quiz"; questions: QuizQuestion[] }
  | { type: "activity"; text: string } // kids workbook-only block (section 12)
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "image"; src: string; alt: string; caption?: string }; // src shared across languages, alt and caption per language

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number; // index into options; order preserved across translations
  explanation?: string;
};

export type TranslationState = "draft" | "inReview" | "approved" | "published";

export type Translation = {
  locale: Locale;
  title: string;
  excerpt: string;
  slug?: string; // per-language slug override (section 12 SEO fields)
  seoTitle?: string;
  seoDescription?: string;
  blocks: Block[];
  state: TranslationState;
  aiDraft: boolean; // "AI-translated, not yet reviewed" label
  outOfDate?: boolean; // source changed after this translation
  publishedAt?: string;
  publishAt?: string; // ISO time with offset: published, but hidden from readers until then
  updatedAt?: string;
};

export type ArticleCategory =
  | "markets"
  | "personalFinance"
  | "tax"
  | "insurance"
  | "loans"
  | "realEstate"
  | "economy"
  | "womenAndMoney"
  | "kidsAndMoney";

export type ArticleFormat = "explainer" | "news" | "howTo" | "story";

export type Article = {
  id: string;
  slug: string;
  sourceLocale: Locale;
  category: ArticleCategory;
  format: ArticleFormat;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt?: string;
  pinned?: boolean; // hero slot
  cover?: string; // illustration under /public, shown on cards and the home page
  relatedCalculator?: string;
  relatedChapter?: string;
  translations: Translation[];
};

/**
 * A short dated update on the home page news column: rate changes, deadlines,
 * scheme notices. Hand-curated in content/news.json, each item linking to the
 * source it was checked against. Unlike articles there is no translation
 * workflow; a missing language falls back to the default one.
 */
export type NewsItem = {
  id: string;
  date: string;
  category: ArticleCategory;
  source: { name: string; url: string };
  translations: { locale: Locale; title: string; summary: string }[];
};

export type Track = "adults" | "kids" | "women";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Chapter = {
  slug: string;
  readingMinutes: number;
  translations: Translation[];
};

export type Module = {
  slug: string;
  track: Track;
  order: number;
  difficulty: Difficulty;
  estimatedHours: number;
  prerequisites?: string[];
  level?: "8-11" | "12-16"; // kids levels
  checkupDimension?: string; // women track links every chapter to a dimension
  translations: { locale: Locale; title: string; summary: string }[];
  chapters: Chapter[];
};
