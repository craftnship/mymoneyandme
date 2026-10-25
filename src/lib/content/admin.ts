import "server-only";
import { getPool, query, type Row } from "../db";
import { routing } from "@/i18n/routing";
import { fromRows, itemId, toRows } from "./rows";
import type { Article } from "./types";

/**
 * Reads and writes for the authoring console. Everything here bypasses the
 * public cache: the console always works on the database as it is.
 */

type ItemDbRow = Row & { id: string; kind: "article"; slug: string; parent_id: null; position: number; settings: string; json_hash: string | null; origin: string };
type TranslationDbRow = Row & { item_id: string; locale: string; title: string; summary: string; state: Article["translations"][number]["state"]; ai_draft: number; published_at: string | null; body: string };

export async function articleForEdit(id: string): Promise<Article | undefined> {
  const key = itemId.article({ id });
  const [items, translations] = await Promise.all([
    query<ItemDbRow>("SELECT id, kind, slug, parent_id, position, settings, json_hash, origin FROM content_items WHERE id = ? AND archived_at IS NULL", [key]),
    query<TranslationDbRow>("SELECT item_id, locale, title, summary, state, ai_draft, published_at, body FROM content_translations WHERE item_id = ?", [key]),
  ]);
  if (!items[0]) return undefined;
  const snapshot = fromRows(
    {
      items: items.map((r) => ({ id: r.id, kind: r.kind, slug: r.slug, parentId: null, position: r.position, settings: r.settings, jsonHash: r.json_hash ?? "" })),
      translations: translations.map((r) => ({ itemId: r.item_id, locale: r.locale, title: r.title, summary: r.summary, state: r.state, aiDraft: Boolean(r.ai_draft), publishedAt: r.published_at, body: r.body })),
    },
    routing.defaultLocale,
  );
  return snapshot.articles[0];
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

/**
 * Saves the whole article in one transaction and records a revision. The
 * item becomes 'admin'-owned, so a later deploy never overwrites it with the
 * JSON file it came from.
 */
export async function saveArticle(article: Article, userId: string): Promise<void> {
  const rows = toRows({ articles: [article], modules: [], news: [] });
  const item = rows.items[0];
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO content_items (id, kind, slug, parent_id, position, settings, origin, json_hash, updated_by)
       VALUES (?, 'article', ?, NULL, 0, ?, 'admin', NULL, ?)
       ON DUPLICATE KEY UPDATE slug = VALUES(slug), settings = VALUES(settings), origin = 'admin', json_hash = NULL,
         updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP, archived_at = NULL`,
      [item.id, item.slug, item.settings, userId],
    );
    await conn.query(`DELETE FROM content_translations WHERE item_id = ? AND locale NOT IN (${rows.translations.map(() => "?").join(", ")})`, [item.id, ...rows.translations.map((t) => t.locale)]);
    for (const t of rows.translations) {
      await conn.query(
        `INSERT INTO content_translations (item_id, locale, title, summary, state, ai_draft, published_at, body, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), state = VALUES(state), ai_draft = VALUES(ai_draft),
           published_at = VALUES(published_at), body = VALUES(body), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        [t.itemId, t.locale, t.title, t.summary, t.state, t.aiDraft ? 1 : 0, t.publishedAt, t.body, userId],
      );
    }
    await conn.query("INSERT INTO content_revisions (item_id, locale, snapshot, saved_by) VALUES (?, NULL, ?, ?)", [item.id, JSON.stringify(article), userId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

export type Revision = { id: number; savedAt: Date; savedBy: string | null };

export async function listRevisions(id: string, limit = 10): Promise<Revision[]> {
  // Two reads instead of a join: the content tables declare utf8mb4_unicode_ci and
  // the member tables use the server default, which MySQL refuses to compare.
  const rows = await query<Row & { id: number; saved_at: Date; saved_by: string | null }>(
    "SELECT id, saved_at, saved_by FROM content_revisions WHERE item_id = ? ORDER BY id DESC LIMIT ?",
    [itemId.article({ id }), limit],
  );
  const ids = [...new Set(rows.map((r) => r.saved_by).filter((x): x is string => Boolean(x)))];
  const names = new Map(
    ids.length ? (await query<Row & { id: string; name: string }>(`SELECT id, name FROM users WHERE id IN (${ids.map(() => "?").join(", ")})`, ids)).map((u) => [u.id, u.name]) : [],
  );
  return rows.map((r) => ({ id: r.id, savedAt: r.saved_at, savedBy: r.saved_by ? names.get(r.saved_by) ?? null : null }));
}
