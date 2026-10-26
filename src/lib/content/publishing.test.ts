import { describe, expect, it } from "vitest";
import { readJsonContent } from "./json";
import { addTranslation, blankCopy, emptyArticle, insertBlock, markOutOfDate, newBlock, patchTranslation, setBlockText, stampTranslationDates } from "./editing";
import { applySchedule, dueBetween, fromIndiaInput, isScheduled, toIndiaInput } from "./schedule";
import { diffDocs } from "./diff";
import { blockSchema, publishProblems } from "./schema";
import type { Article } from "./types";

const NOW = new Date("2026-10-26T06:30:00Z"); // 12:00 in India

describe("scheduled publishing", () => {
  it("reads and writes datetime-local values as India time", () => {
    expect(fromIndiaInput("2026-10-27T09:00")).toBe("2026-10-27T09:00:00+05:30");
    expect(toIndiaInput("2026-10-27T09:00:00+05:30")).toBe("2026-10-27T09:00");
    expect(toIndiaInput("2026-10-27T03:30:00Z")).toBe("2026-10-27T09:00");
    expect(fromIndiaInput("")).toBeUndefined();
  });

  it("hides a scheduled language from readers until its time, then lists it as due", () => {
    const json = readJsonContent();
    const a = json.articles[0];
    const scheduled = { ...a, translations: a.translations.map((t) => (t.locale === "en" ? { ...t, publishAt: "2026-10-26T15:00:00+05:30" } : t)) };
    const s = { ...json, articles: [scheduled, ...json.articles.slice(1)] };
    expect(applySchedule(s, NOW).articles[0].translations.find((t) => t.locale === "en")!.state).toBe("approved");
    const later = new Date("2026-10-26T09:40:00Z");
    expect(applySchedule(s, later).articles[0].translations.find((t) => t.locale === "en")!.state).toBe("published");
    expect(dueBetween(s, NOW, later)).toEqual([{ path: `/articles/${a.slug}`, locale: "en" }]);
    expect(dueBetween(s, later, new Date(later.getTime() + 60_000))).toEqual([]);
  });

  it("dates a scheduled language by its time and drops the time from unpublished ones", () => {
    const base = emptyArticle("art-x", "2026-10-26").translations[0];
    const [scheduled] = stampTranslationDates([{ ...base, state: "published", publishAt: "2026-10-28T08:00:00+05:30", publishedAt: "2026-10-01" }], "2026-10-26", NOW);
    expect(scheduled.publishedAt).toBe("2026-10-28");
    expect(isScheduled(scheduled, NOW)).toBe(true);
    const [draft] = stampTranslationDates([{ ...base, publishAt: "2026-10-28T08:00:00+05:30" }], "2026-10-26", NOW);
    expect(draft.publishAt).toBeUndefined();
  });
});

describe("out-of-date translations", () => {
  const base: Article = patchTranslation(addTranslation(emptyArticle("art-x", "2026-10-26"), "ta"), "ta", { title: "த" });

  it("flags languages left behind when the source text changes, and clears them when they are edited", () => {
    const edited = setBlockText(base, "en", 0, { type: "paragraph", text: "New English" });
    const marked = markOutOfDate(base, edited);
    expect(marked.translations.find((t) => t.locale === "ta")!.outOfDate).toBe(true);
    const caught = markOutOfDate(marked, setBlockText(marked, "ta", 0, { type: "paragraph", text: "புதியது" }));
    expect(caught.translations.find((t) => t.locale === "ta")!.outOfDate).toBeUndefined();
  });

  it("ignores structure changes that every language gets at once", () => {
    const withBlock = insertBlock(base, 1, { type: "heading", level: 2, text: "" });
    expect(markOutOfDate(base, withBlock).translations.find((t) => t.locale === "ta")!.outOfDate).toBeUndefined();
    const english = setBlockText(withBlock, "en", 1, { type: "heading", level: 2, text: "Why" });
    expect(markOutOfDate(base, english).translations.find((t) => t.locale === "ta")!.outOfDate).toBe(true);
  });

  it("keeps the flag when nothing changed and lets the editor clear it by hand", () => {
    const flagged = patchTranslation(base, "ta", { outOfDate: true });
    expect(markOutOfDate(flagged, flagged).translations.find((t) => t.locale === "ta")!.outOfDate).toBe(true);
    expect(markOutOfDate(flagged, patchTranslation(flagged, "ta", { outOfDate: undefined })).translations.find((t) => t.locale === "ta")!.outOfDate).toBeUndefined();
    expect(markOutOfDate(undefined, flagged)).toBe(flagged);
  });
});

describe("image blocks", () => {
  it("shares the picture, empties alt and caption for other languages, and needs a picture to publish", () => {
    const img = { type: "image" as const, src: "/media/abc", alt: "A chart", caption: "Source: RBI" };
    expect(blankCopy(img)).toEqual({ type: "image", src: "/media/abc", alt: "", caption: "" });
    expect(blockSchema.safeParse(img).success).toBe(true);
    expect(blockSchema.safeParse({ ...img, src: "https://evil.example/x.png" }).success).toBe(false);
    const a = insertBlock(emptyArticle("art-x", "2026-10-26"), 1, newBlock("image"));
    const t = { ...a.translations[0], title: "T", excerpt: "E", blocks: [{ type: "paragraph" as const, text: "x" }, { type: "image" as const, src: "", alt: "Alt" }] };
    expect(publishProblems(t, t, new Set()).map((p) => p.code)).toEqual(["imageMissing"]);
  });
});

describe("revision differences", () => {
  it("lists changed settings, language fields and blocks with before and after", () => {
    const a = addTranslation(emptyArticle("art-x", "2026-10-26"), "ta");
    const b = { ...setBlockText(patchTranslation(a, "en", { title: "New title" }), "en", 0, { type: "paragraph", text: "Body" }), tags: ["tax"] };
    const changes = diffDocs(a, b);
    expect(changes.map((c) => c.key)).toEqual(["s:tags", "t:en:title", "b:en:0"]);
    expect(changes[1]).toMatchObject({ before: "", after: "New title" });
    expect(diffDocs(a, a)).toEqual([]);
  });
});
