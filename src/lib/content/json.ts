import fs from "node:fs";
import path from "node:path";
import type { Article, Module, NewsItem, Track } from "./types";

/**
 * The JSON files under /content. They seed the database on first use and stay
 * the fallback whenever DATABASE_URL is missing or the database is unreachable
 * (local development, the Hostinger build sandbox).
 */
export type ContentSnapshot = { articles: Article[]; modules: Module[]; news: NewsItem[] };

const ROOT = path.join(process.cwd(), "content");
export const TRACKS: Track[] = ["adults", "kids", "women"];

function readJsonDir<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T);
}

/** Articles newest first, modules in curriculum order, news newest first: the order every page lists them in. */
export function sortSnapshot(s: ContentSnapshot): ContentSnapshot {
  return {
    articles: [...s.articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    modules: [...s.modules].sort((a, b) => a.order - b.order),
    news: [...s.news].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function readJsonContent(): ContentSnapshot {
  const newsFile = path.join(ROOT, "news.json");
  return sortSnapshot({
    articles: readJsonDir<Article>(path.join(ROOT, "articles")),
    modules: TRACKS.flatMap((t) => readJsonDir<Module>(path.join(ROOT, "modules", t))),
    news: fs.existsSync(newsFile) ? (JSON.parse(fs.readFileSync(newsFile, "utf8")) as NewsItem[]) : [],
  });
}
