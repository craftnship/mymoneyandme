"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ArticleCategory, NewsItem } from "@/lib/content/types";
import { ARTICLE_CATEGORIES } from "@/lib/content/categories";
import { removeItemAction, saveNewsAction } from "@/lib/content/actions";
import { fieldClass } from "./BlockFields";
import { SaveBar, btn, useEditor, type Lang } from "./editorParts";

/**
 * A news item: date, category, the source it was checked against, and a
 * title and summary per language. News has no workflow, so every language
 * with a title is live on save; a language left empty falls back to the
 * default one.
 */
export function NewsEditor({ initial, isNew, langs, sourceLocale }: { initial: NewsItem; isNew: boolean; langs: Lang[]; sourceLocale: string }) {
  const t = useTranslations("admin.newsEditor");
  const te = useTranslations("admin.editor");
  const ta = useTranslations("article");
  const ui = useLocale();
  const router = useRouter();
  const { value: item, update, dirty, setDirty, status, setStatus, pending, save } = useEditor(initial);
  const text = (code: string) => item.translations.find((x) => x.locale === code) ?? { locale: code, title: "", summary: "" };
  const patch = (code: string, p: { title?: string; summary?: string }) =>
    update((n) => ({ ...n, translations: [...n.translations.filter((x) => x.locale !== code), { ...text(code), ...p }].sort((a, b) => (a.locale === sourceLocale ? -1 : b.locale === sourceLocale ? 1 : a.locale.localeCompare(b.locale))) }));

  const onSave = () => {
    const translations = item.translations.map((x) => ({ ...x, title: x.title.trim(), summary: x.summary.trim() })).filter((x) => x.title || x.summary || x.locale === sourceLocale);
    if (translations.some((x) => !x.title || !x.summary) || !item.source.name.trim() || !/^https?:\/\/\S+\.\S+/.test(item.source.url)) {
      setStatus({ tone: "error", text: t("incomplete") });
      return;
    }
    save(() => saveNewsAction(ui, JSON.stringify({ ...item, translations }), isNew), (res) => {
      if (isNew) router.replace(`/admin/news/${res.id}`);
      else router.refresh();
    });
  };

  const onRemove = async () => {
    if (!window.confirm(t("removeConfirm"))) return;
    const res = await removeItemAction(ui, "news", { id: item.id });
    if (res.ok) {
      for (const path of res.refresh) await fetch(path, { cache: "no-store", credentials: "omit" }).catch(() => undefined);
      setDirty(false);
      router.replace("/admin");
    } else setStatus({ tone: "error", text: te(`errors.${res.error}`) });
  };

  return (
    <div className="space-y-8 pb-24">
      <section className="rounded-card border border-border p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("date")}</span>
            <input type="date" value={item.date} onChange={(e) => e.target.value && update((n) => ({ ...n, date: e.target.value }))} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{te("category")}</span>
            <select value={item.category} onChange={(e) => update((n) => ({ ...n, category: e.target.value as ArticleCategory }))} className={fieldClass}>
              {ARTICLE_CATEGORIES.map((c) => <option key={c} value={c}>{ta(`category.${c}`)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("sourceName")}</span>
            <input value={item.source.name} onChange={(e) => update((n) => ({ ...n, source: { ...n.source, name: e.target.value } }))} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">{t("sourceUrl")}</span>
            <input type="url" inputMode="url" placeholder="https://" value={item.source.url} onChange={(e) => update((n) => ({ ...n, source: { ...n.source, url: e.target.value.trim() } }))} className={fieldClass} />
            <span className="block text-xs text-fg-muted mt-1">{t("sourceHint")}</span>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{te("languages")}</h2>
        <p className="text-sm text-fg-muted">{t("languagesHint")}</p>
        <div className={`grid gap-4 ${langs.length > 1 ? "md:grid-cols-2" : ""}`}>
          {langs.map((l) => (
            <div key={l.code} lang={l.code} dir={l.dir} className="rounded-card border border-border p-4 space-y-3">
              <p className="font-semibold">{l.name}{l.code === sourceLocale ? ` · ${t("required")}` : ""}</p>
              <label className="block text-sm"><span className="block mb-1">{te("title")}</span><input value={text(l.code).title} onChange={(e) => patch(l.code, { title: e.target.value })} className={fieldClass} /></label>
              <label className="block text-sm"><span className="block mb-1">{te("excerpt")}</span><textarea rows={4} value={text(l.code).summary} onChange={(e) => patch(l.code, { summary: e.target.value })} className={fieldClass} /></label>
            </div>
          ))}
        </div>
      </section>

      <SaveBar onSave={onSave} pending={pending} dirty={dirty} status={status} langs={langs} extra={!isNew ? <button type="button" className={btn} onClick={onRemove}>{t("remove")}</button> : null} />
    </div>
  );
}
