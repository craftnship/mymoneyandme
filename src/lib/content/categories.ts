import type { ArticleCategory } from "./types";

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
