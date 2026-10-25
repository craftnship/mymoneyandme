import { describe, expect, it } from "vitest";
import { readJsonContent, type ContentSnapshot } from "./json";
import { fromRows, toRows } from "./rows";

/** Translation order is not part of the model (the store sorts source first), so compare with it fixed. */
function normalise(s: ContentSnapshot): ContentSnapshot {
  const byLocale = <T extends { locale: string }>(ts: T[]) => [...ts].sort((a, b) => a.locale.localeCompare(b.locale));
  return {
    articles: s.articles.map((a) => ({ ...a, translations: byLocale(a.translations) })),
    modules: s.modules.map((m) => ({ ...m, translations: byLocale(m.translations), chapters: m.chapters.map((c) => ({ ...c, translations: byLocale(c.translations) })) })),
    news: s.news.map((n) => ({ ...n, translations: byLocale(n.translations) })),
  };
}

describe("content rows", () => {
  const json = readJsonContent();
  const rows = toRows(json);

  it("round-trips every file under /content unchanged", () => {
    expect(normalise(fromRows(rows))).toEqual(normalise(json));
  });

  it("gives every item a unique id and every translation a known item", () => {
    const ids = rows.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(ids);
    for (const t of rows.translations) expect(known.has(t.itemId), t.itemId).toBe(true);
    const chapters = json.modules.reduce((n, m) => n + m.chapters.length, 0);
    expect(rows.items.filter((i) => i.kind === "chapter")).toHaveLength(chapters);
    expect(rows.items.filter((i) => i.kind === "article")).toHaveLength(json.articles.length);
  });

  it("changes an item's hash only when that item changes", () => {
    const edited: ContentSnapshot = { ...json, articles: json.articles.map((a, i) => (i === 0 ? { ...a, tags: [...a.tags, "edited"] } : a)) };
    const after = toRows(edited);
    const changed = after.items.filter((item) => rows.items.find((r) => r.id === item.id)?.jsonHash !== item.jsonHash);
    expect(changed.map((c) => c.id)).toEqual([`article:${json.articles[0].id}`]);
  });

  it("lists module chapters in file order", () => {
    const back = fromRows(rows);
    for (const m of json.modules) {
      expect(back.modules.find((x) => x.track === m.track && x.slug === m.slug)?.chapters.map((c) => c.slug)).toEqual(m.chapters.map((c) => c.slug));
    }
  });
});
