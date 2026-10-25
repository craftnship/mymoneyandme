import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { _resetForTests, execute, getPool, query } from "../db";
import { readJsonContent, type ContentSnapshot } from "./json";
import { loadFromDb, syncFromJson } from "./db";
import { itemId } from "./rows";

const url = process.env.DATABASE_URL;
const sorted = <T extends { locale: string }>(ts: T[]) => [...ts].sort((a, b) => a.locale.localeCompare(b.locale));

describe.skipIf(!url)("content in the database", () => {
  const json = readJsonContent();

  beforeAll(async () => {
    await getPool();
    await execute("DELETE FROM content_translations");
    await execute("DELETE FROM content_items");
  });
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("imports every file on the first sync and nothing on the second", async () => {
    const first = await syncFromJson(json);
    const items = json.articles.length + json.news.length + json.modules.reduce((n, m) => n + 1 + m.chapters.length, 0);
    expect(first).toEqual({ inserted: items, updated: 0, archived: 0 });
    expect(await syncFromJson(json)).toEqual({ inserted: 0, updated: 0, archived: 0 });
  });

  it("reads back the same content the files hold, Tamil included", async () => {
    const back = await loadFromDb();
    expect(back.articles.map((a) => a.slug)).toEqual(json.articles.map((a) => a.slug));
    for (const a of json.articles) {
      const b = back.articles.find((x) => x.id === a.id)!;
      expect(sorted(b.translations)).toEqual(sorted(a.translations));
    }
    expect(back.modules.map((m) => `${m.track}/${m.slug}`)).toEqual(json.modules.map((m) => `${m.track}/${m.slug}`));
    expect(back.news).toEqual(json.news.map((n) => ({ ...n, translations: [...n.translations].sort((a, b) => (a.locale === "en" ? -1 : b.locale === "en" ? 1 : 0)) })));
  });

  it("refreshes items owned by the files, archives removed ones, and never touches admin edits", async () => {
    const [first, second, ...rest] = json.articles;
    await execute("UPDATE content_items SET origin = 'admin', settings = ? WHERE id = ?", [JSON.stringify({ ...second, translations: undefined, tags: ["admin edit"] }), itemId.article(second)]);
    const changed: ContentSnapshot = {
      ...json,
      articles: [{ ...first, tags: ["changed in file"] }, { ...second, tags: ["changed in file too"] }, ...rest.slice(1)],
    };
    const report = await syncFromJson(changed);
    expect(report).toEqual({ inserted: 0, updated: 1, archived: 1 });
    const back = await loadFromDb();
    expect(back.articles.find((a) => a.id === first.id)?.tags).toEqual(["changed in file"]);
    expect(back.articles.find((a) => a.id === second.id)?.tags).toEqual(["admin edit"]);
    expect(back.articles.find((a) => a.id === rest[0].id)).toBeUndefined();

    // The file comes back: the archived copy is restored.
    expect(await syncFromJson(json)).toEqual({ inserted: 0, updated: 2, archived: 0 });
    const rows = await query("SELECT id FROM content_items WHERE archived_at IS NOT NULL");
    expect(rows).toHaveLength(0);
  });
});

describe.skipIf(!url)("saving from the authoring console", () => {
  afterAll(async () => {
    const p = await getPool();
    await p.end();
    _resetForTests();
  });

  it("saves an article as admin-owned, keeps a revision, and survives the next JSON sync", async () => {
    const { saveArticle, articleForEdit, listRevisions, slugTaken } = await import("./admin");
    const json = readJsonContent();
    await syncFromJson(json);
    const original = json.articles[0];
    const edited = { ...original, tags: ["edited in console"], translations: original.translations.map((t) => (t.locale === "en" ? { ...t, title: "Edited title" } : t)) };
    await saveArticle(edited, "00000000-0000-0000-0000-000000000001");
    const back = await articleForEdit(original.id);
    expect(back?.tags).toEqual(["edited in console"]);
    expect(back?.translations.find((t) => t.locale === "en")?.title).toBe("Edited title");
    expect((await listRevisions(original.id)).length).toBeGreaterThanOrEqual(1);
    expect(await syncFromJson(json)).toEqual({ inserted: 0, updated: 0, archived: 0 });
    expect((await loadFromDb()).articles.find((a) => a.id === original.id)?.tags).toEqual(["edited in console"]);
    expect(await slugTaken(original.slug, original.id)).toBe(false);
    expect(await slugTaken(original.slug, "art-other")).toBe(true);

    const fresh = { ...original, id: "art-new1", slug: "a-brand-new-article", translations: [{ ...original.translations[0], state: "draft" as const }] };
    await saveArticle(fresh, "00000000-0000-0000-0000-000000000001");
    expect((await loadFromDb()).articles.find((a) => a.id === "art-new1")?.translations).toHaveLength(1);
    await execute("DELETE FROM content_items WHERE id IN (?, ?)", [itemId.article(original), "article:art-new1"]);
    await execute("DELETE FROM content_translations WHERE item_id IN (?, ?)", [itemId.article(original), "article:art-new1"]);
  });
});
