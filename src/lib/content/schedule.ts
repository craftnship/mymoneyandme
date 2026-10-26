import type { ContentSnapshot } from "./json";
import type { Translation } from "./types";

/**
 * Scheduled publishing. A translation can be published with a `publishAt`
 * time; until then readers must not see it, so the public snapshot treats it
 * as approved but not yet published. The console reads the database
 * directly and keeps showing the real state.
 */
export function isScheduled(t: Pick<Translation, "state" | "publishAt">, now: Date): boolean {
  return t.state === "published" && Boolean(t.publishAt) && new Date(t.publishAt!) > now;
}

function hold(ts: Translation[], now: Date): Translation[] {
  return ts.some((t) => isScheduled(t, now)) ? ts.map((t) => (isScheduled(t, now) ? { ...t, state: "approved" as const } : t)) : ts;
}

export function applySchedule(s: ContentSnapshot, now: Date): ContentSnapshot {
  return {
    ...s,
    articles: s.articles.map((a) => ({ ...a, translations: hold(a.translations, now) })),
    modules: s.modules.map((m) => ({ ...m, chapters: m.chapters.map((c) => ({ ...c, translations: hold(c.translations, now) })) })),
  };
}

/** Every scheduled translation in the snapshot that went live in the window (from, to]. */
export function dueBetween(s: ContentSnapshot, from: Date, to: Date): { path: string; locale: string }[] {
  const due = (t: Translation) => t.state === "published" && t.publishAt && new Date(t.publishAt) > from && new Date(t.publishAt) <= to;
  return [
    ...s.articles.flatMap((a) => a.translations.filter(due).map((t) => ({ path: `/articles/${t.slug ?? a.slug}`, locale: t.locale }))),
    ...s.modules.flatMap((m) => m.chapters.flatMap((c) => c.translations.filter(due).map((t) => ({ path: `/learn/${m.track}/${m.slug}/${c.slug}`, locale: t.locale })))),
  ];
}

const IST = "+05:30";

/** An ISO time as the value of a datetime-local input, in India time. */
export function toIndiaInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

/** A datetime-local value, read as India time, as an ISO time with its offset. */
export function fromIndiaInput(local: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00${IST}` : undefined;
}

/** The calendar date in India of an ISO time. */
export function indiaDate(iso: string): string {
  return toIndiaInput(iso).slice(0, 10);
}
