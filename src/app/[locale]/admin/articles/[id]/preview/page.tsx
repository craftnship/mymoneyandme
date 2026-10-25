import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { localeMeta } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { articleForEdit } from "@/lib/content/admin";
import { readingMinutes } from "@/lib/content/store";
import { BlockRenderer } from "@/components/BlockRenderer";
import { Notice, Pill } from "@/components/ui";

/** The article as readers would see it, from the last save, drafts included. */
export default async function PreviewArticlePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { locale, id } = await params;
  const { lang } = await searchParams;
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const article = await articleForEdit(id).catch(() => undefined);
  const translation = article?.translations.find((tr) => tr.locale === (lang ?? article.sourceLocale));
  if (!article || !translation) notFound();
  const t = await getTranslations("admin.editor");
  const ta = await getTranslations("article");
  const th = await getTranslations("home");
  const f = await getFormatter();
  return (
    <article className="max-w-3xl mx-auto" lang={translation.locale}>
      <div className="mb-6"><Notice tone="warning">{t("previewBanner", { language: localeMeta(translation.locale).nativeName, state: t(`states.${translation.state === "approved" ? "inReview" : translation.state}`) })}</Notice></div>
      {/* eslint-disable-next-line @next/next/no-img-element -- covers are plain images everywhere on the site */}
      {article.cover ? <img src={article.cover} alt="" className="mb-6 w-full aspect-[16/9] object-cover rounded-card" /> : null}
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill tone="accent">{ta(`category.${article.category}`)}</Pill>
        <Pill>{ta(`format.${article.format}`)}</Pill>
        <span className="text-xs text-fg-muted self-center">{f.dateTime(new Date(article.publishedAt), { dateStyle: "long" })} · {th("minRead", { minutes: readingMinutes(translation) })}</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{translation.title}</h1>
      <p className="mt-3 text-lg text-fg-muted">{translation.excerpt}</p>
      {translation.aiDraft ? <div className="mt-5"><Notice tone="info">{ta("aiTranslated")}</Notice></div> : null}
      <div className="mt-8 text-[1.0625rem]"><BlockRenderer blocks={translation.blocks} /></div>
    </article>
  );
}
