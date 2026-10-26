"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Chapter } from "@/lib/content/types";
import { estimateMinutes, slugify, type ChapterDoc } from "@/lib/content/editing";
import { removeItemAction, saveChapterAction } from "@/lib/content/actions";
import { fieldClass } from "./BlockFields";
import { RestoredNotice, SaveBar, TranslatedBody, btn, useEditor, type Calc, type Lang } from "./editorParts";

/**
 * The chapter editor: the article editor's languages and body (quizzes
 * included) with a chapter's own two settings. A new chapter picks its web
 * address once; it is part of the chapter's link and never changes after.
 */
export function ChapterEditor({ initial, isNew, track, moduleSlug, sourceLocale, langs, calculators, restored }: { initial: Chapter; isNew: boolean; track: string; moduleSlug: string; sourceLocale: string; langs: Lang[]; calculators: Calc[]; restored?: string }) {
  const t = useTranslations("admin.chapter");
  const te = useTranslations("admin.editor");
  const ui = useLocale();
  const router = useRouter();
  const { value: doc, update, dirty, setDirty, status, setStatus, pending, save } = useEditor<ChapterDoc>({ ...initial, sourceLocale }, Boolean(restored));
  const source = doc.translations.find((tr) => tr.locale === sourceLocale) ?? doc.translations[0];
  const base = `/admin/learn/${track}/${moduleSlug}`;
  const removable = !isNew && !initial.translations.some((tr) => tr.state === "published");

  const onSave = () => {
    const { slug, readingMinutes, translations } = doc;
    save(() => saveChapterAction(ui, track, moduleSlug, JSON.stringify({ slug, readingMinutes, translations }), isNew), (res) => {
      if (isNew || restored) router.replace(`${base}/${res.id}`);
      else router.refresh();
    });
  };

  const onRemove = async () => {
    if (!window.confirm(t("removeConfirm"))) return;
    const res = await removeItemAction(ui, "chapter", { track, module: moduleSlug, chapter: doc.slug });
    if (res.ok) {
      setDirty(false);
      router.replace(base);
    } else setStatus({ tone: "error", text: te(`errors.${res.error}`) });
  };

  return (
    <div className="space-y-8 pb-24">
      <RestoredNotice text={restored} />
      <section className="rounded-card border border-border p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium mb-1">{te("slug")}</span>
            {isNew ? (
              <span className="flex gap-2">
                <input value={doc.slug} onChange={(e) => update((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} className={fieldClass} />
                <button type="button" className={btn} onClick={() => update((d) => ({ ...d, slug: slugify(source?.title ?? "") }))}>{te("slugFromTitle")}</button>
              </span>
            ) : <input value={doc.slug} readOnly className={`${fieldClass} opacity-70`} />}
            <span className="block text-xs text-fg-muted mt-1">{isNew ? t("slugHintNew") : t("slugHintFixed")}</span>
          </label>
          <div className="block text-sm">
            <label htmlFor="reading-minutes" className="block font-medium mb-1">{t("readingMinutes")}</label>
            <span className="flex gap-2">
              <input id="reading-minutes" type="number" min={1} max={240} value={doc.readingMinutes} onChange={(e) => update((d) => ({ ...d, readingMinutes: Math.max(1, Math.min(240, Math.round(Number(e.target.value) || 1))) }))} className={fieldClass} />
              <button type="button" className={btn} onClick={() => source && update((d) => ({ ...d, readingMinutes: estimateMinutes(source) }))}>{t("estimate")}</button>
            </span>
          </div>
        </div>
      </section>

      <TranslatedBody doc={doc} update={update} langs={langs} calculators={calculators} previewHref={isNew ? undefined : (l) => `${base}/${doc.slug}/preview?lang=${l}`} />

      <SaveBar
        onSave={onSave}
        pending={pending}
        dirty={dirty}
        status={status}
        langs={langs}
        extra={removable ? <button type="button" className={btn} onClick={onRemove}>{t("remove")}</button> : null}
      />
    </div>
  );
}
