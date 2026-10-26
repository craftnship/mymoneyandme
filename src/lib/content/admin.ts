import "server-only";
import { execute, getPool, query, type PoolConnection, type Row } from "../db";
import { routing } from "@/i18n/routing";
import type { ContentSnapshot } from "./json";
import { fromRows, itemId, toRows, type ItemKind, type TranslationRow } from "./rows";
import type { ModuleEdit } from "./schema";
import type { Article, Chapter, Module, NewsItem, Track } from "./types";

/**
 * Reads and writes for the authoring console. Everything here bypasses the
 * public cache: the console always works on the database as it is. Every
 * write marks the item 'admin'-owned, so a later deploy never overwrites it
 * with the JSON file it came from.
 */

type ItemDbRow = Row & { id: string; kind: ItemKind; slug: string; parent_id: string | null; position: number; settings: string; json_hash: string | null };
type TranslationDbRow = Row & { item_id: string; locale: string; title: string; summary: string; state: Article["translations"][number]["state"]; ai_draft: number; published_at: string | null; body: string };

/** Live items matching `where` (on content_items, aliased i), with their translations, in the content model's shape. */
async function load(where: string, params: unknown[]): Promise<ContentSnapshot> {
  const [items, translations] = await Promise.all([
    query<ItemDbRow>(`SELECT i.id, i.kind, i.slug, i.parent_id, i.position, i.settings, i.json_hash FROM content_items i WHERE i.archived_at IS NULL AND (${where})`, params),
    query<TranslationDbRow>(
      `SELECT t.item_id, t.locale, t.title, t.summary, t.state, t.ai_draft, t.published_at, t.body FROM content_translations t JOIN content_items i ON i.id = t.item_id WHERE i.archived_at IS NULL AND (${where})`,
      params,
    ),
  ]);
  return fromRows(
    {
      items: items.map((r) => ({ id: r.id, kind: r.kind, slug: r.slug, parentId: r.parent_id, position: r.position, settings: r.settings, jsonHash: r.json_hash ?? "" })),
      translations: translations.map((r) => ({ itemId: r.item_id, locale: r.locale, title: r.title, summary: r.summary, state: r.state, aiDraft: Boolean(r.ai_draft), publishedAt: r.published_at, body: r.body })),
    },
    routing.defaultLocale,
  );
}

export async function articleForEdit(id: string): Promise<Article | undefined> {
  return (await load("i.id = ?", [itemId.article({ id })])).articles[0];
}

/** The module with every live chapter, in order. */
export async function moduleForEdit(track: Track, slug: string): Promise<Module | undefined> {
  const key = itemId.module({ track, slug });
  return (await load("i.id = ? OR i.parent_id = ?", [key, key])).modules[0];
}

export async function chapterForEdit(track: Track, moduleSlug: string, chapterSlug: string): Promise<{ module: Module; chapter: Chapter } | undefined> {
  const mod = await moduleForEdit(track, moduleSlug);
  const chapter = mod?.chapters.find((c) => c.slug === chapterSlug);
  return mod && chapter ? { module: mod, chapter } : undefined;
}

export async function newsForEdit(id: string): Promise<NewsItem | undefined> {
  return (await load("i.id = ?", [itemId.news({ id })])).news[0];
}

/** True when another live article already uses the slug, as its own or as a language's slug. */
export async function slugTaken(slug: string, exceptId: string): Promise<boolean> {
  const rows = await query<Row & { id: string }>(
    `SELECT DISTINCT i.id FROM content_items i LEFT JOIN content_translations t ON t.item_id = i.id
     WHERE i.kind = 'article' AND i.archived_at IS NULL AND i.id <> ? AND (i.slug = ? OR JSON_UNQUOTE(JSON_EXTRACT(t.body, '$.slug')) = ?)`,
    [itemId.article({ id: exceptId }), slug, slug],
  );
  return rows.length > 0;
}

type ItemWrite = { id: string; kind: ItemKind; slug: string; parentId: string | null; position: number; settings: string };

/**
 * Writes one item and replaces its translations, inside the caller's
 * transaction, and records a revision with the whole item as saved.
 */
async function writeItem(conn: PoolConnection, item: ItemWrite, translations: TranslationRow[], snapshot: unknown, userId: string) {
  await conn.query(
    `INSERT INTO content_items (id, kind, slug, parent_id, position, settings, origin, json_hash, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'admin', NULL, ?)
     ON DUPLICATE KEY UPDATE slug = VALUES(slug), parent_id = VALUES(parent_id), position = VALUES(position), settings = VALUES(settings), origin = 'admin',
       json_hash = NULL, updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP, archived_at = NULL`,
    [item.id, item.kind, item.slug, item.parentId, item.position, item.settings, userId],
  );
  await conn.query(`DELETE FROM content_translations WHERE item_id = ? AND locale NOT IN (${translations.map(() => "?").join(", ")})`, [item.id, ...translations.map((t) => t.locale)]);
  for (const t of translations) {
    await conn.query(
      `INSERT INTO content_translations (item_id, locale, title, summary, state, ai_draft, published_at, body, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), state = VALUES(state), ai_draft = VALUES(ai_draft),
         published_at = VALUES(published_at), body = VALUES(body), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
      [t.itemId, t.locale, t.title, t.summary, t.state, t.aiDraft ? 1 : 0, t.publishedAt, t.body, userId],
    );
  }
  await conn.query("INSERT INTO content_revisions (item_id, locale, snapshot, saved_by) VALUES (?, NULL, ?, ?)", [item.id, JSON.stringify(snapshot), userId]);
}

async function inTransaction(fn: (conn: PoolConnection) => Promise<void>): Promise<void> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await fn(conn);
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

/** Saves the whole article in one transaction and records a revision. */
export async function saveArticle(article: Article, userId: string): Promise<void> {
  const rows = toRows({ articles: [article], modules: [], news: [] });
  await inTransaction((conn) => writeItem(conn, { ...rows.items[0], parentId: null, position: 0 }, rows.translations, article, userId));
}

/**
 * Saves a chapter of `module`. A chapter keeps its place; a new one goes to
 * the end. The slug is part of the chapter's address and id, so the console
 * never changes it once the chapter exists.
 */
export async function saveChapter(module: Pick<Module, "track" | "slug">, chapter: Chapter, userId: string): Promise<void> {
  const moduleKey = itemId.module(module);
  const key = itemId.chapter(module, chapter);
  const rows = toRows({ articles: [], news: [], modules: [{ ...(module as Module), translations: [], chapters: [chapter] }] });
  const item = rows.items.find((i) => i.id === key)!;
  await inTransaction(async (conn) => {
    const [found] = await conn.query<(Row & { id: string; position: number; archived_at: Date | null })[]>(
      "SELECT id, position, archived_at FROM content_items WHERE parent_id = ? FOR UPDATE",
      [moduleKey],
    );
    const current = found.find((r) => r.id === key && !r.archived_at);
    const position = current ? current.position : found.filter((r) => !r.archived_at).reduce((n, r) => Math.max(n, r.position + 1), 0);
    await writeItem(conn, { ...item, parentId: moduleKey, position }, rows.translations.filter((t) => t.itemId === key), chapter, userId);
  });
}

/** True when the module already has a live chapter at this address. */
export async function chapterExists(module: Pick<Module, "track" | "slug">, slug: string): Promise<boolean> {
  const rows = await query<Row & { id: string }>("SELECT id FROM content_items WHERE id = ? AND archived_at IS NULL", [itemId.chapter(module, { slug })]);
  return rows.length > 0;
}

/**
 * Saves a module's titles, summaries, difficulty and hours, and puts its
 * chapters in `edit.chapterOrder`. Chapters whose place changes become
 * console-owned too, or the next deploy would put them back where their file
 * has them.
 */
export async function saveModule(existing: Module, edit: ModuleEdit, userId: string): Promise<void> {
  const { chapters, ...rest } = existing;
  const next: Module = { ...rest, difficulty: edit.difficulty, estimatedHours: edit.estimatedHours, translations: edit.translations, chapters: [] };
  const rows = toRows({ articles: [], news: [], modules: [next] });
  const moduleKey = itemId.module(existing);
  await inTransaction(async (conn) => {
    await writeItem(conn, { ...rows.items[0], parentId: null, position: existing.order }, rows.translations, { ...next, chapterOrder: edit.chapterOrder }, userId);
    for (const [position, slug] of edit.chapterOrder.entries()) {
      if (chapters[position]?.slug === slug) continue;
      await conn.query(
        "UPDATE content_items SET position = ?, origin = 'admin', json_hash = NULL, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND parent_id = ?",
        [position, userId, itemId.chapter(existing, { slug }), moduleKey],
      );
    }
  });
}

export async function saveNews(item: NewsItem, userId: string): Promise<void> {
  const rows = toRows({ articles: [], modules: [], news: [item] });
  await inTransaction((conn) => writeItem(conn, { ...rows.items[0], parentId: null, position: 0 }, rows.translations, item, userId));
}

/**
 * Takes an item off the site. The row stays, archived and console-owned, so
 * its JSON file (if any) does not bring it back on the next deploy, and its
 * revisions stay readable.
 */
export async function archiveItem(key: string, userId: string): Promise<void> {
  await execute("UPDATE content_items SET archived_at = CURRENT_TIMESTAMP, origin = 'admin', json_hash = NULL, updated_by = ? WHERE id = ?", [userId, key]);
}

export type Revision = { id: number; savedAt: Date; savedBy: string | null };

/** Latest saves of one item, by its content_items id (see itemId). */
export async function listRevisions(key: string, limit = 10): Promise<Revision[]> {
  // Two reads instead of a join: the content tables declare utf8mb4_unicode_ci and
  // the member tables use the server default, which MySQL refuses to compare.
  const rows = await query<Row & { id: number; saved_at: Date; saved_by: string | null }>(
    "SELECT id, saved_at, saved_by FROM content_revisions WHERE item_id = ? ORDER BY id DESC LIMIT ?",
    [key, limit],
  );
  const ids = [...new Set(rows.map((r) => r.saved_by).filter((x): x is string => Boolean(x)))];
  const names = new Map(
    ids.length ? (await query<Row & { id: string; name: string }>(`SELECT id, name FROM users WHERE id IN (${ids.map(() => "?").join(", ")})`, ids)).map((u) => [u.id, u.name]) : [],
  );
  return rows.map((r) => ({ id: r.id, savedAt: r.saved_at, savedBy: r.saved_by ? names.get(r.saved_by) ?? null : null }));
}

export type SavedRevision = Revision & { itemKey: string; snapshot: unknown };

export async function getRevision(id: number): Promise<SavedRevision | undefined> {
  const [r] = await query<Row & { id: number; item_id: string; snapshot: string | object; saved_at: Date; saved_by: string | null }>(
    "SELECT id, item_id, snapshot, saved_at, saved_by FROM content_revisions WHERE id = ?",
    [id],
  );
  if (!r) return undefined;
  const [who] = r.saved_by ? await query<Row & { name: string }>("SELECT name FROM users WHERE id = ?", [r.saved_by]) : [];
  return { id: r.id, itemKey: r.item_id, snapshot: typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot, savedAt: r.saved_at, savedBy: who?.name ?? null };
}
