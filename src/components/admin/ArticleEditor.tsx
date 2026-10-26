"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Article } from "@/lib/content/types";
import { ARTICLE_CATEGORIES } from "@/lib/content/categories";
import { slugify } from "@/lib/content/editing";
import { saveArticleAction, uploadImageAction } from "@/lib/content/actions";
import { fieldClass } from "./BlockFields";
import { RestoredNotice, SaveBar, TranslatedBody, btn, useEditor, type Calc, type Lang } from "./editorParts";

type Option = { value: string; label: string };

/**
 * The article editor: settings on top, then every language side by side,
 * block by block. Saving sends the whole article to saveArticleAction.
 */
export function ArticleEditor({ initial, isNew, langs, calculators, chapters, restored }: { initial: Article; isNew: boolean; langs: Lang[]; calculators: Calc[]; chapters: Option[]; restored?: string }) {
  const t = useTranslations("admin.editor");
  const ta = useTranslations("article");
  const ui = useLocale();
  const router = useRouter();
  const { value: article, update, dirty, status, setStatus, pending, save } = useEditor(initial, Boolean(restored));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const source = article.translations.find((tr) => tr.locale === article.sourceLocale) ?? article.translations[0];

  const onSave = () =>
    save(() => saveArticleAction(ui, JSON.stringify(article), isNew), (res) => {
      if (isNew || restored) router.replace(`/admin/articles/${res.id}`);
      else router.refresh();
    });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const res = await uploadImageAction(ui, form);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) update((a) => ({ ...a, cover: res.url }));
    else setStatus({ tone: "error", text: t(`errors.upload.${res.error}`) });
  };

  return (
    <div className="space-y-8 pb-24">
      <RestoredNotice text={restored} />
      {/* Settings shared by every language */}
      <section className="rounded-card border border-border p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("slug")}</span>
            <span className="flex gap-2">
              <input value={article.slug} onChange={(e) => update((a) => ({ ...a, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} className={fieldClass} />
              <button type="button" className={btn} onClick={() => update((a) => ({ ...a, slug: slugify(source?.title ?? "") }))}>{t("slugFromTitle")}</button>
            </span>
            <span className="block text-xs text-fg-muted mt-1">{t("slugHint")}</span>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("category")}</span>
            <select value={article.category} onChange={(e) => update((a) => ({ ...a, category: e.target.value as Article["category"] }))} className={fieldClass}>
              {ARTICLE_CATEGORIES.map((c) => <option key={c} value={c}>{ta(`category.${c}`)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("format")}</span>
            <select value={article.format} onChange={(e) => update((a) => ({ ...a, format: e.target.value as Article["format"] }))} className={fieldClass}>
              {(["explainer", "howTo", "story", "news"] as const).map((f) => <option key={f} value={f}>{ta(`format.${f}`)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("tags")}</span>
            <input defaultValue={article.tags.join(", ")} onBlur={(e) => update((a) => ({ ...a, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) }))} className={fieldClass} />
            <span className="block text-xs text-fg-muted mt-1">{t("tagsHint")}</span>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("author")}</span>
            <input value={article.author} onChange={(e) => update((a) => ({ ...a, author: e.target.value }))} className={fieldClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-medium mb-1">{t("publishedAt")}</span>
              <input type="date" value={article.publishedAt} onChange={(e) => e.target.value && update((a) => ({ ...a, publishedAt: e.target.value }))} className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="block font-medium mb-1">{t("updatedAt")}</span>
              <input type="date" value={article.updatedAt ?? ""} onChange={(e) => update((a) => ({ ...a, updatedAt: e.target.value || undefined }))} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("relatedCalculator")}</span>
            <select value={article.relatedCalculator ?? ""} onChange={(e) => update((a) => ({ ...a, relatedCalculator: e.target.value || undefined }))} className={fieldClass}>
              <option value="">{t("none")}</option>
              {calculators.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("relatedChapter")}</span>
            <select value={article.relatedChapter ?? ""} onChange={(e) => update((a) => ({ ...a, relatedChapter: e.target.value || undefined }))} className={fieldClass}>
              <option value="">{t("none")}</option>
              {chapters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- covers are plain images everywhere on the site */}
          <img src={article.cover ?? "/images/articles/default.svg"} alt="" className="w-48 aspect-[16/9] object-cover rounded-lg border border-border" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t("cover")}</p>
            <p className="text-xs text-fg-muted">{t("coverHint")}</p>
            <div className="flex flex-wrap gap-2">
              <label className={`${btn} cursor-pointer`}>
                {uploading ? t("uploading") : t("uploadCover")}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {article.cover ? <button type="button" className={btn} onClick={() => update((a) => ({ ...a, cover: undefined }))}>{t("removeCover")}</button> : null}
            </div>
          </div>
        </div>
      </section>

      <TranslatedBody doc={article} update={update} langs={langs} calculators={calculators} previewHref={isNew ? undefined : (l) => `/admin/articles/${article.id}/preview?lang=${l}`} />

      <SaveBar onSave={onSave} pending={pending} dirty={dirty} status={status} langs={langs} />
    </div>
  );
}
