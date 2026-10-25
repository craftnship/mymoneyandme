import "server-only";
import { getPool, query, type Row } from "../db";
import { routing } from "@/i18n/routing";
import type { ContentSnapshot } from "./json";
import { fromRows, toRows, type ItemKind, type ItemOrigin, type TranslationRow } from "./rows";
import type { TranslationState } from "./types";

export type SyncReport = { inserted: number; updated: number; archived: number };

/**
 * Brings the database in line with the JSON files. Missing items are added,
 * items still owned by the files (origin 'json') are replaced when their file
 * changed and archived when their file is gone, and items edited in the admin
 * (origin 'admin') are left alone. Idempotent, so every process can run it on
 * its first content read and two processes racing each other converge.
 */
export async function syncFromJson(json: ContentSnapshot): Promise<SyncReport> {
  const rows = toRows(json);
  const existing = new Map(
    (await query<Row & { id: string; origin: ItemOrigin; json_hash: string | null; archived_at: Date | null }>(
      "SELECT id, origin, json_hash, archived_at FROM content_items",
    )).map((r) => [r.id, r]),
  );
  const translationsOf = new Map<string, TranslationRow[]>();
  for (const t of rows.translations) translationsOf.set(t.itemId, [...(translationsOf.get(t.itemId) ?? []), t]);

  const report: SyncReport = { inserted: 0, updated: 0, archived: 0 };
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of rows.items) {
      const current = existing.get(item.id);
      if (current && (current.origin !== "json" || (current.json_hash === item.jsonHash && !current.archived_at))) continue;
      await conn.query(
        `INSERT INTO content_items (id, kind, slug, parent_id, position, settings, origin, json_hash)
         VALUES (?, ?, ?, ?, ?, ?, 'json', ?)
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), slug = VALUES(slug), parent_id = VALUES(parent_id), position = VALUES(position),
           settings = VALUES(settings), json_hash = VALUES(json_hash), archived_at = NULL, updated_at = CURRENT_TIMESTAMP`,
        [item.id, item.kind, item.slug, item.parentId, item.position, item.settings, item.jsonHash],
      );
      const ts = translationsOf.get(item.id) ?? [];
      await conn.query("DELETE FROM content_translations WHERE item_id = ?", [item.id]);
      for (const t of ts) {
        await conn.query(
          `INSERT INTO content_translations (item_id, locale, title, summary, state, ai_draft, published_at, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), state = VALUES(state), ai_draft = VALUES(ai_draft),
             published_at = VALUES(published_at), body = VALUES(body), updated_at = CURRENT_TIMESTAMP`,
          [t.itemId, t.locale, t.title, t.summary, t.state, t.aiDraft ? 1 : 0, t.publishedAt, t.body],
        );
      }
      if (current) report.updated++;
      else report.inserted++;
    }
    const inFiles = new Set(rows.items.map((i) => i.id));
    for (const [id, r] of existing) {
      if (r.origin === "json" && !r.archived_at && !inFiles.has(id)) {
        await conn.query("UPDATE content_items SET archived_at = CURRENT_TIMESTAMP WHERE id = ? AND origin = 'json'", [id]);
        report.archived++;
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
  return report;
}

type ItemDbRow = Row & { id: string; kind: ItemKind; slug: string; parent_id: string | null; position: number; settings: string; json_hash: string | null };
type TranslationDbRow = Row & { item_id: string; locale: string; title: string; summary: string; state: TranslationState; ai_draft: number; published_at: string | null; body: string };

/** Every item that is not archived, in the same shape the JSON files have. Drafts are included; pages filter on state. */
export async function loadFromDb(): Promise<ContentSnapshot> {
  const [items, translations] = await Promise.all([
    query<ItemDbRow>("SELECT id, kind, slug, parent_id, position, settings, json_hash FROM content_items WHERE archived_at IS NULL"),
    query<TranslationDbRow>(
      "SELECT t.item_id, t.locale, t.title, t.summary, t.state, t.ai_draft, t.published_at, t.body FROM content_translations t JOIN content_items i ON i.id = t.item_id WHERE i.archived_at IS NULL",
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

export type ItemMeta = { id: string; origin: ItemOrigin; updatedAt: Date };

/** Who owns each item (the files or the admin) and when it last changed, for the admin lists. */
export async function itemMeta(): Promise<Map<string, ItemMeta>> {
  const rows = await query<Row & { id: string; origin: ItemOrigin; updated_at: Date }>("SELECT id, origin, updated_at FROM content_items WHERE archived_at IS NULL");
  return new Map(rows.map((r) => [r.id, { id: r.id, origin: r.origin, updatedAt: r.updated_at }]));
}
