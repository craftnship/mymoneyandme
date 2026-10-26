"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Difficulty, Module, Translation } from "@/lib/content/types";
import { moveItem } from "@/lib/content/editing";
import { saveModuleAction } from "@/lib/content/actions";
import { Pill } from "@/components/ui";
import { fieldClass } from "./BlockFields";
import { SaveBar, btn, useEditor, type Lang } from "./editorParts";

type ChapterRow = { slug: string; title: string; minutes: number; states: Record<string, Translation["state"] | undefined> };
type State = { difficulty: Difficulty; estimatedHours: number; translations: Module["translations"]; order: ChapterRow[] };

/**
 * A module's page in the console: its title and summary per language, its
 * difficulty and hours, and its chapters, which can be put in a new order
 * here and opened to edit. A language left without a title is dropped.
 */
export function ModuleEditor({ module, chapters, langs, sourceLocale }: { module: Pick<Module, "track" | "slug" | "difficulty" | "estimatedHours" | "translations">; chapters: ChapterRow[]; langs: Lang[]; sourceLocale: string }) {
  const t = useTranslations("admin.module");
  const ts = useTranslations("admin.state");
  const tl = useTranslations("learn");
  const ui = useLocale();
  const router = useRouter();
  const { value, update, dirty, status, setStatus, pending, save } = useEditor<State>({ difficulty: module.difficulty, estimatedHours: module.estimatedHours, translations: module.translations, order: chapters });
  const base = `/admin/learn/${module.track}/${module.slug}`;
  const text = (code: string) => value.translations.find((x) => x.locale === code) ?? { locale: code, title: "", summary: "" };
  const patch = (code: string, p: { title?: string; summary?: string }) =>
    update((v) => ({ ...v, translations: [...v.translations.filter((x) => x.locale !== code), { ...text(code), ...p }].sort((a, b) => (a.locale === sourceLocale ? -1 : b.locale === sourceLocale ? 1 : a.locale.localeCompare(b.locale))) }));

  const onSave = () => {
    const translations = value.translations.map((x) => ({ ...x, title: x.title.trim(), summary: x.summary.trim() })).filter((x) => x.title || x.locale === sourceLocale);
    if (translations.some((x) => !x.title || !x.summary)) {
      setStatus({ tone: "error", text: t("textMissing") });
      return;
    }
    const payload = { track: module.track, slug: module.slug, difficulty: value.difficulty, estimatedHours: value.estimatedHours, translations, chapterOrder: value.order.map((c) => c.slug) };
    save(() => saveModuleAction(ui, JSON.stringify(payload)), () => router.refresh());
  };

  return (
    <div className="space-y-8 pb-24">
      <section className="rounded-card border border-border p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("difficulty")}</span>
            <select value={value.difficulty} onChange={(e) => update((v) => ({ ...v, difficulty: e.target.value as Difficulty }))} className={fieldClass}>
              {(["beginner", "intermediate", "advanced"] as const).map((d) => <option key={d} value={d}>{tl(`difficulty.${d}`)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("hours")}</span>
            <input type="number" min={0.5} max={200} step={0.5} value={value.estimatedHours} onChange={(e) => update((v) => ({ ...v, estimatedHours: Math.max(0.5, Math.min(200, Number(e.target.value) || 0.5)) }))} className={fieldClass} />
          </label>
        </div>
        <div className={`grid gap-4 ${langs.length > 1 ? "md:grid-cols-2" : ""}`}>
          {langs.map((l) => (
            <div key={l.code} lang={l.code} dir={l.dir} className="rounded-card border border-border p-4 space-y-3">
              <p className="font-semibold">{l.name}{l.code === sourceLocale ? ` · ${t("required")}` : ""}</p>
              <label className="block text-sm"><span className="block mb-1">{t("title")}</span><input value={text(l.code).title} onChange={(e) => patch(l.code, { title: e.target.value })} className={fieldClass} /></label>
              <label className="block text-sm"><span className="block mb-1">{t("summary")}</span><textarea rows={3} value={text(l.code).summary} onChange={(e) => patch(l.code, { summary: e.target.value })} className={fieldClass} /></label>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold me-auto">{t("chapters")}</h2>
          <Link href={`${base}/new`} className={btn}>{t("addChapter")}</Link>
        </div>
        <p className="text-sm text-fg-muted">{t("orderHint")}</p>
        <ol className="divide-y divide-border rounded-card border border-border">
          {value.order.map((c, i) => (
            <li key={c.slug} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-mono text-sm text-fg-muted w-6">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`${base}/${c.slug}`} className="font-medium underline-offset-4 hover:underline">{c.title || c.slug}</Link>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {langs.map((l) => <Pill key={l.code} tone={c.states[l.code] === "published" ? "accent" : c.states[l.code] ? "warn" : "neutral"}>{l.name}: {ts(c.states[l.code] ?? "missing")}</Pill>)}
                  <span className="text-fg-muted self-center">· {c.minutes} min</span>
                </div>
              </div>
              <span className="flex gap-1">
                <button type="button" className={btn} aria-label={t("moveUp", { title: c.title })} disabled={i === 0} onClick={() => update((v) => ({ ...v, order: moveItem(v.order, i, -1) }))}>↑</button>
                <button type="button" className={btn} aria-label={t("moveDown", { title: c.title })} disabled={i === value.order.length - 1} onClick={() => update((v) => ({ ...v, order: moveItem(v.order, i, 1) }))}>↓</button>
              </span>
            </li>
          ))}
        </ol>
        {value.order.length === 0 ? <p className="text-sm text-fg-muted">{t("noChapters")}</p> : null}
      </section>

      <SaveBar onSave={onSave} pending={pending} dirty={dirty} status={status} langs={langs} />
    </div>
  );
}
