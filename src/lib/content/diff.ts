import type { Block } from "./types";
import { blockTexts } from "./schema";

/**
 * A plain change list between two saved versions of an item (article,
 * chapter, module or news), for the revision page: which settings, which
 * language fields and which blocks differ, with the text before and after.
 */
export type Where =
  | { kind: "setting"; field: string }
  | { kind: "text"; locale: string; field: string }
  | { kind: "block"; locale: string; index: number; type: Block["type"] };

export type Change = { key: string; where: Where; before?: string; after?: string };

type Entry = { where: Where; value: string };

const TEXT_FIELDS = ["title", "excerpt", "summary", "state", "publishAt", "slug", "seoTitle", "seoDescription", "aiDraft"];

function show(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function blockValue(b: Block): string {
  const shared = b.type === "calculator" ? b.slug : b.type === "image" ? b.src : b.type === "heading" ? `H${b.level}` : "";
  return [shared, ...blockTexts(b)].filter(Boolean).join("\n");
}

function entries(doc: Record<string, unknown>): Map<string, Entry> {
  const out = new Map<string, Entry>();
  for (const [field, value] of Object.entries(doc)) {
    if (field === "translations" || field === "chapters" || value === undefined) continue;
    out.set(`s:${field}`, { where: { kind: "setting", field }, value: show(value) });
  }
  for (const t of (doc.translations ?? []) as Record<string, unknown>[]) {
    const locale = String(t.locale);
    for (const field of TEXT_FIELDS) if (t[field] !== undefined) out.set(`t:${locale}:${field}`, { where: { kind: "text", locale, field }, value: show(t[field]) });
    ((t.blocks ?? []) as Block[]).forEach((b, index) => out.set(`b:${locale}:${index}`, { where: { kind: "block", locale, index, type: b.type }, value: blockValue(b) }));
  }
  return out;
}

/** What changed from `before` to `after`, settings first, then by language and block. */
export function diffDocs(before: object, after: object): Change[] {
  const a = entries(before as Record<string, unknown>);
  const b = entries(after as Record<string, unknown>);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const changes: Change[] = [];
  for (const key of keys) {
    const x = a.get(key);
    const y = b.get(key);
    if (x?.value === y?.value) continue;
    changes.push({ key, where: (y ?? x)!.where, before: x?.value, after: y?.value });
  }
  const rank = (c: Change) => (c.where.kind === "setting" ? 0 : 1);
  return changes.sort((p, q) => rank(p) - rank(q));
}
