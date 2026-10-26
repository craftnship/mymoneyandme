import "server-only";
import { articleForEdit, chapterForEdit, getRevision, moduleForEdit, newsForEdit } from "./admin";
import { isTrack } from "./json";
import { articleSchema, chapterSchema, newsSchema } from "./schema";
import type { Article, Chapter, NewsItem, Track } from "./types";

/** Which item a content_items id names, and where its editor lives. */
export type ItemRef =
  | { kind: "article"; id: string }
  | { kind: "chapter"; track: Track; module: string; chapter: string }
  | { kind: "module"; track: Track; module: string }
  | { kind: "news"; id: string };

export function parseItemKey(key: string): ItemRef | undefined {
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const rest = at > 0 ? key.slice(at + 1) : "";
  const parts = rest.split("/");
  if (kind === "article" && rest) return { kind, id: rest };
  if (kind === "news" && rest) return { kind, id: rest };
  if (kind === "module" && parts.length === 2 && isTrack(parts[0])) return { kind, track: parts[0], module: parts[1] };
  if (kind === "chapter" && parts.length === 3 && isTrack(parts[0])) return { kind, track: parts[0], module: parts[1], chapter: parts[2] };
  return undefined;
}

export function editorPath(ref: ItemRef): string {
  switch (ref.kind) {
    case "article": return `/admin/articles/${ref.id}`;
    case "news": return `/admin/news/${ref.id}`;
    case "module": return `/admin/learn/${ref.track}/${ref.module}`;
    case "chapter": return `/admin/learn/${ref.track}/${ref.module}/${ref.chapter}`;
  }
}

/** The item as it is now, in the shape its revisions were saved in. */
export async function currentOf(ref: ItemRef): Promise<object | undefined> {
  switch (ref.kind) {
    case "article": return articleForEdit(ref.id);
    case "news": return newsForEdit(ref.id);
    case "chapter": return (await chapterForEdit(ref.track, ref.module, ref.chapter))?.chapter;
    case "module": {
      const m = await moduleForEdit(ref.track, ref.module);
      if (!m) return undefined;
      const { chapters, ...rest } = m;
      return { ...rest, chapterOrder: chapters.map((c) => c.slug) };
    }
  }
}

/**
 * A saved version to load back into an editor, when it belongs to the item
 * being edited and still passes today's checks. Nothing is written: the
 * editor opens with it and the person saves it like any other change.
 */
export async function restoredVersion(revisionId: string | undefined, key: string, kind: "article"): Promise<{ doc: Article; savedAt: Date } | undefined>;
export async function restoredVersion(revisionId: string | undefined, key: string, kind: "chapter"): Promise<{ doc: Chapter; savedAt: Date } | undefined>;
export async function restoredVersion(revisionId: string | undefined, key: string, kind: "news"): Promise<{ doc: NewsItem; savedAt: Date } | undefined>;
export async function restoredVersion(revisionId: string | undefined, key: string, kind: "article" | "chapter" | "news") {
  if (!revisionId || !/^\d{1,12}$/.test(revisionId)) return undefined;
  const rev = await getRevision(Number(revisionId)).catch(() => undefined);
  if (!rev || rev.itemKey !== key) return undefined;
  const schema = kind === "article" ? articleSchema : kind === "chapter" ? chapterSchema : newsSchema;
  const parsed = schema.safeParse(rev.snapshot);
  return parsed.success ? { doc: parsed.data, savedAt: rev.savedAt } : undefined;
}
