"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Article, Translation } from "@/lib/content/types";
import type { Problem } from "@/lib/content/schema";
import { ARTICLE_CATEGORIES } from "@/lib/content/categories";
import {
  BLOCK_TYPES, addTranslation, insertBlock, moveBlock, newBlock, patchTranslation, removeBlock, setBlockShared, setBlockText, slugify, type BlockType,
} from "@/lib/content/editing";
import { saveArticleAction, uploadImageAction } from "@/lib/content/actions";
import { BlockFields, fieldClass } from "./BlockFields";
import { BlockToolbar } from "./BlockToolbar";

type Lang = { code: string; name: string; dir: "ltr" | "rtl" };
type Option = { value: string; label: string };

const btn = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent-soft disabled:opacity-50";
const STATES: Translation["state"][] = ["draft", "inReview", "published"];

/**
 * The article editor: settings on top, then every language side by side,
 * block by block. Structure is shared (see src/lib/content/editing.ts), text
 * is per language. Saving sends the whole article to saveArticleAction.
 */
export function ArticleEditor({ initial, isNew, langs, calculators, chapters }: { initial: Article; isNew: boolean; langs: Lang[]; calculators: { slug: string; name: string }[]; chapters: Option[] }) {
  const t = useTranslations("admin.editor");
  const ta = useTranslations("article");
  const ui = useLocale();
  const router = useRouter();
  const [article, setArticle] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string; problems?: Problem[] } | null>(null);
  const [pending, start] = useTransition();
  const [newType, setNewType] = useState<BlockType>("paragraph");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (a: Article) => Article) => {
    setArticle(fn);
    setDirty(true);
    setStatus(null);
  };
  const shown = langs.filter((l) => article.translations.some((tr) => tr.locale === l.code));
  const missing = langs.filter((l) => !article.translations.some((tr) => tr.locale === l.code));
  const source = article.translations.find((tr) => tr.locale === article.sourceLocale) ?? article.translations[0];
  const langName = (code: string) => langs.find((l) => l.code === code)?.name ?? code;
  const calcName = (slug: string) => calculators.find((c) => c.slug === slug)?.name ?? slug;
  const cols = shown.length > 1 ? "md:grid-cols-2" : "";

  const save = () =>
    start(async () => {
      const res = await saveArticleAction(ui, JSON.stringify(article), isNew);
      if (res.ok) {
        // Take the one stale view each public page serves after a change, so readers get the new one.
        for (const path of res.refresh) await fetch(path, { cache: "no-store", credentials: "omit" }).catch(() => undefined);
        setDirty(false);
        setStatus({ tone: "ok", text: t("saved") });
        if (isNew) router.replace(`/admin/articles/${res.id}`);
        else router.refresh();
      } else {
        setStatus({ tone: "error", text: t(`errors.${res.error}`), problems: res.problems });
      }
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

  const problemText = (p: Problem) => {
    const language = langName(p.locale);
    return "block" in p ? t(`problems.${p.code}`, { language, block: p.block + 1 }) : t(`problems.${p.code}`, { language });
  };

  return (
    <div className="space-y-8 pb-24">
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

      {/* Per-language title, summary and state */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold me-auto">{t("languages")}</h2>
          {missing.map((l) => (
            <button key={l.code} type="button" className={btn} onClick={() => update((a) => addTranslation(a, l.code))}>{t("startLanguage", { language: l.name })}</button>
          ))}
        </div>
        <div className={`grid gap-4 ${cols}`}>
          {shown.map((l) => {
            const tr = article.translations.find((x) => x.locale === l.code)!;
            const patch = (p: Partial<Translation>) => update((a) => patchTranslation(a, l.code, p));
            return (
              <div key={l.code} lang={l.code} dir={l.dir} className="rounded-card border border-border p-4 space-y-3">
                <p className="font-semibold">{l.name}{l.code === article.sourceLocale ? ` · ${t("source")}` : ""}</p>
                <label className="block text-sm"><span className="block mb-1">{t("title")}</span><input value={tr.title} onChange={(e) => patch({ title: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm"><span className="block mb-1">{t("excerpt")}</span><textarea rows={3} value={tr.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} className={fieldClass} /></label>
                <details className="text-sm">
                  <summary className="cursor-pointer text-fg-muted">{t("seo")}</summary>
                  <div className="mt-2 space-y-2">
                    <label className="block"><span className="block mb-1">{t("seoTitle")}</span><input value={tr.seoTitle ?? ""} onChange={(e) => patch({ seoTitle: e.target.value || undefined })} className={fieldClass} /></label>
                    <label className="block"><span className="block mb-1">{t("seoDescription")}</span><textarea rows={2} value={tr.seoDescription ?? ""} onChange={(e) => patch({ seoDescription: e.target.value || undefined })} className={fieldClass} /></label>
                  </div>
                </details>
                <fieldset className="text-sm">
                  <legend className="mb-1">{t("state")}</legend>
                  <div className="flex flex-wrap gap-3">
                    {STATES.map((s) => (
                      <label key={s} className="flex items-center gap-1">
                        <input type="radio" name={`state-${l.code}`} checked={tr.state === s || (s === "inReview" && tr.state === "approved")} onChange={() => patch({ state: s })} />
                        {t(`states.${s}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={tr.aiDraft} onChange={(e) => patch({ aiDraft: e.target.checked })} />
                  {t("aiDraft")}
                </label>
                {!isNew ? (
                  <Link href={`/admin/articles/${article.id}/preview?lang=${l.code}`} target="_blank" className="inline-block text-sm underline underline-offset-4">{t("preview", { language: l.name })}</Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Body, block by block */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("body")}</h2>
        <p className="text-sm text-fg-muted">{t("bodyHint")}</p>
        {(source?.blocks ?? []).map((b, i) => (
          <div key={i} className="rounded-card border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{i + 1}. {t(`blockTypes.${b.type}`)}</span>
              <BlockToolbar block={b} calculators={calculators} onShared={(change) => update((a) => setBlockShared(a, i, change))} />
              <span className="ms-auto flex gap-1">
                <button type="button" className={btn} aria-label={t("moveUp")} disabled={i === 0} onClick={() => update((a) => moveBlock(a, i, -1))}>↑</button>
                <button type="button" className={btn} aria-label={t("moveDown")} disabled={i === (source?.blocks.length ?? 0) - 1} onClick={() => update((a) => moveBlock(a, i, 1))}>↓</button>
                <button type="button" className={btn} aria-label={t("removeBlock")} onClick={() => update((a) => removeBlock(a, i))}>✕</button>
              </span>
            </div>
            <div className={`grid gap-4 ${cols}`}>
              {shown.map((l) => {
                const tr = article.translations.find((x) => x.locale === l.code)!;
                const block = tr.blocks[i];
                if (!block) return <p key={l.code} className="text-sm text-danger">{t("problems.structureDiffers", { language: l.name, block: i + 1 })}</p>;
                return (
                  <div key={l.code} lang={l.code}>
                    {shown.length > 1 ? <p className="text-xs text-fg-muted mb-1">{l.name}</p> : null}
                    <BlockFields block={block} lang={l.code} dir={l.dir} calculatorName={calcName} onChange={(nb) => update((a) => setBlockText(a, l.code, i, nb))} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t("blockType")} value={newType} onChange={(e) => setNewType(e.target.value as BlockType)} className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm">
            {BLOCK_TYPES.map((bt) => <option key={bt} value={bt}>{t(`blockTypes.${bt}`)}</option>)}
          </select>
          <button type="button" className={btn} onClick={() => update((a) => insertBlock(a, source?.blocks.length ?? 0, newBlock(newType, calculators[0]?.slug)))}>{t("addBlock")}</button>
        </div>
      </section>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong disabled:opacity-60">
            {pending ? t("saving") : t("save")}
          </button>
          <span className="text-sm text-fg-muted">{dirty ? t("unsaved") : null}</span>
          {status ? (
            <div role={status.tone === "error" ? "alert" : "status"} className={`text-sm ${status.tone === "error" ? "text-danger" : "text-accent-strong"}`}>
              {status.text}
              {status.problems?.length ? <ul className="list-disc ps-5">{status.problems.slice(0, 6).map((p, k) => <li key={k}>{problemText(p)}</li>)}</ul> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
