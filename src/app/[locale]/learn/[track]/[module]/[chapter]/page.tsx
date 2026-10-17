import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta } from "@/i18n/routing";
import { allModules, getChapter, moduleTitle, resolveTranslation } from "@/lib/content/store";
import type { Track } from "@/lib/content/types";
import { BlockRenderer } from "@/components/BlockRenderer";
import { Notice } from "@/components/ui";

export function generateStaticParams() {
  return allModules().flatMap((m) =>
    m.chapters.filter((c) => c.translations.some((t) => t.state === "published")).map((c) => ({ track: m.track, module: m.slug, chapter: c.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }> }) {
  const { locale, track, module: mod, chapter } = await params;
  const hit = getChapter(track as Track, mod, chapter);
  if (!hit) return {};
  const r = resolveTranslation(hit.chapter.translations, locale);
  return r ? { title: r.translation.title, description: r.translation.excerpt } : {};
}

export default async function ChapterPage({ params }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }> }) {
  const { locale, track, module: mod, chapter } = await params;
  const hit = getChapter(track as Track, mod, chapter);
  if (!hit) notFound();
  const r = resolveTranslation(hit.chapter.translations, locale);
  if (!r) notFound();
  const t = await getTranslations("learn");
  const ta = await getTranslations("article");
  const { module, index } = hit;
  const title = moduleTitle(module, locale);
  const prev = module.chapters.slice(0, index).reverse().find((c) => resolveTranslation(c.translations, locale));
  const next = module.chapters.slice(index + 1).find((c) => resolveTranslation(c.translations, locale));

  return (
    <article className="max-w-3xl mx-auto">
      <p className="text-sm text-fg-muted">
        <Link href={`/learn/${module.track}`} className="underline underline-offset-4">{t(`track.${module.track}.title`)}</Link>
        {" / "}
        <Link href={`/learn/${module.track}/${module.slug}`} className="underline underline-offset-4">{title.title}</Link>
      </p>
      <p className="mt-4 text-sm font-medium text-accent-strong">{t("chapterOf", { index: index + 1, total: module.chapters.length })}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{r.translation.title}</h1>
      <p className="mt-3 text-lg text-fg-muted">{r.translation.excerpt}</p>
      <div className="mt-4 space-y-3">
        {r.fallback ? <Notice tone="warning">{ta("notTranslated", { language: localeMeta(locale).nativeName, shown: localeMeta(r.locale).nativeName })}</Notice> : null}
        {r.translation.aiDraft ? <Notice tone="info">{ta("aiTranslated")}</Notice> : null}
      </div>
      <div className="mt-8">
        <BlockRenderer blocks={r.translation.blocks} kids={module.track === "kids"} />
      </div>
      <nav className="mt-12 flex justify-between gap-4 text-sm">
        {prev ? <Link href={`/learn/${module.track}/${module.slug}/${prev.slug}`} className="underline underline-offset-4">← {t("previousChapter")}</Link> : <span />}
        {next ? <Link href={`/learn/${module.track}/${module.slug}/${next.slug}`} className="underline underline-offset-4">{t("nextChapter")} →</Link> : <Link href={`/learn/${module.track}/${module.slug}`} className="underline underline-offset-4">{t("backToModule")}</Link>}
      </nav>
    </article>
  );
}
