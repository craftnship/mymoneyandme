import type { Article, ArticleCategory } from "./types";
import { resolveTranslation } from "./store";

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  "personalFinance",
  "markets",
  "tax",
  "insurance",
  "loans",
  "realEstate",
  "economy",
  "womenAndMoney",
  "kidsAndMoney",
];

export function isArticleCategory(value: unknown): value is ArticleCategory {
  return typeof value === "string" && (ARTICLE_CATEGORIES as string[]).includes(value);
}

export type ArticleQuery = { q?: string; category?: ArticleCategory };

/**
 * Plain-text article search (section 4: search and category filters on the
 * feed). Matches the resolved translation for the visitor's language plus the
 * English source and tags, so a Tamil reader still finds an article by its
 * English term. Case-folded substring match on every whitespace-separated
 * term; all terms must match.
 */
export function searchArticles(articles: Article[], locale: string, query: ArticleQuery): Article[] {
  const terms = (query.q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return articles.filter((a) => {
    if (query.category && a.category !== query.category) return false;
    if (terms.length === 0) return true;
    const r = resolveTranslation(a.translations, locale);
    if (!r) return false;
    const source = a.translations.find((t) => t.locale === a.sourceLocale);
    const haystack = [r.translation.title, r.translation.excerpt, source?.title, source?.excerpt, ...a.tags, a.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

export function normaliseArticleQuery(params: Record<string, string | string[] | undefined>): ArticleQuery {
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : undefined;
  const category = isArticleCategory(params.category) ? params.category : undefined;
  return { q: q && q.trim() ? q.trim() : undefined, category };
}
