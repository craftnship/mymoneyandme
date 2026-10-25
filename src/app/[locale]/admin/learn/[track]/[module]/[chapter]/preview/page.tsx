import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { localeMeta, routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { chapterForEdit } from "@/lib/content/admin";
import { isTrack } from "@/lib/content/json";
import { moduleTitle } from "@/lib/content/store";
import { BlockRenderer } from "@/components/BlockRenderer";
import { Notice } from "@/components/ui";

/** The chapter as readers would see it, from the last save, drafts included. */
export default async function PreviewChapterPage({ params, searchParams }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { locale, track, module: moduleSlug, chapter: chapterSlug } = await params;
  const { lang } = await searchParams;
  const access = await adminAccess(locale);
  if (!access.ok || !isTrack(track)) notFound();
  const hit = await chapterForEdit(track, moduleSlug, chapterSlug).catch(() => undefined);
  const translation = hit?.chapter.translations.find((tr) => tr.locale === (lang ?? routing.defaultLocale));
  if (!hit || !translation) notFound();
  const t = await getTranslations("admin.editor");
  const tl = await getTranslations("learn");
  const ta = await getTranslations("article");
  const index = hit.module.chapters.findIndex((c) => c.slug === hit.chapter.slug);
  return (
    <article className="max-w-3xl mx-auto" lang={translation.locale}>
      <div className="mb-6"><Notice tone="warning">{t("previewBanner", { language: localeMeta(translation.locale).nativeName, state: t(`states.${translation.state === "approved" ? "inReview" : translation.state}`) })}</Notice></div>
      <p className="text-sm text-fg-muted">{tl(`track.${hit.module.track}.title`)} / {moduleTitle(hit.module, translation.locale)?.title}</p>
      <p className="mt-4 text-sm font-medium text-accent-strong">{tl("chapterOf", { index: index + 1, total: hit.module.chapters.length })}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{translation.title}</h1>
      <p className="mt-3 text-lg text-fg-muted">{translation.excerpt}</p>
      {translation.aiDraft ? <div className="mt-4"><Notice tone="info">{ta("aiTranslated")}</Notice></div> : null}
      <div className="mt-8"><BlockRenderer blocks={translation.blocks} kids={hit.module.track === "kids"} /></div>
    </article>
  );
}
