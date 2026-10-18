import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta, routing } from "@/i18n/routing";
import { allArticles, availableLocales, getArticle, readingMinutes, resolveTranslation } from "@/lib/content/store";
import { BlockRenderer } from "@/components/BlockRenderer";
import { Notice, Pill } from "@/components/ui";
import { NewsletterSignup } from "@/components/NewsletterSignup";

export function generateStaticParams() {
  return allArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const r = resolveTranslation(article.translations, locale);
  if (!r) return {};
  return {
    title: r.translation.seoTitle ?? r.translation.title,
    description: r.translation.seoDescription ?? r.translation.excerpt,
    alternates: { languages: Object.fromEntries(availableLocales(article.translations).map((l) => [l, `/${l}/articles/${article.slug}`])) },
    openGraph: { type: "article", publishedTime: article.publishedAt, modifiedTime: article.updatedAt },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const r = resolveTranslation(article.translations, locale);
  if (!r) notFound();
  const t = await getTranslations("article");
  const tc = await getTranslations("calc");
  const th = await getTranslations("home");
  const f = await getFormatter();
  const { translation, fallback } = r;
  const langs = availableLocales(article.translations).filter((l) => (routing.locales as readonly string[]).includes(l));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: translation.title,
    description: translation.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: { "@type": "Organization", name: article.author },
    inLanguage: r.locale,
  };

  return (
    <article className="max-w-3xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill tone="accent">{t(`category.${article.category}`)}</Pill>
        <Pill>{t(`format.${article.format}`)}</Pill>
        <span className="text-xs text-fg-muted self-center">{f.dateTime(new Date(article.publishedAt), { dateStyle: "long" })} · {th("minRead", { minutes: readingMinutes(translation) })}</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{translation.title}</h1>
      <p className="mt-3 text-lg text-fg-muted">{translation.excerpt}</p>
      {article.updatedAt ? <p className="mt-2 text-sm text-fg-muted">{t("updatedOn", { date: f.dateTime(new Date(article.updatedAt), { dateStyle: "medium" }) })}</p> : null}

      <div className="mt-5 space-y-3">
        {fallback ? (
          <Notice tone="warning">
            {t("notTranslated", { language: localeMeta(locale).nativeName, shown: localeMeta(r.locale).nativeName })}{" "}
            <a href={`mailto:hello@mymoneyandme.in?subject=Translation request: ${article.slug} (${locale})`} className="underline">{t("requestTranslation")}</a>
          </Notice>
        ) : null}
        {translation.aiDraft ? (
          <Notice tone="info">
            {t("aiTranslated")}{" "}
            <a href={`mailto:hello@mymoneyandme.in?subject=Translation issue: ${article.slug} (${locale})`} className="underline">{t("reportIssue")}</a>
          </Notice>
        ) : null}
        {langs.length > 1 ? (
          <p className="text-sm text-fg-muted">
            {t("availableIn")}:{" "}
            {langs.map((l, i) => (
              <span key={l}>
                {i > 0 ? " · " : ""}
                <Link href={`/articles/${article.slug}`} locale={l} lang={l} className={l === r.locale && !fallback ? "font-semibold" : "underline underline-offset-4"}>
                  {localeMeta(l).nativeName}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="mt-8 text-[1.0625rem]">
        <BlockRenderer blocks={translation.blocks} />
      </div>

      {(article.relatedCalculator || article.relatedChapter) ? (
        <section className="mt-10 rounded-card border border-border p-5">
          <p className="font-semibold">{t("related")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {article.relatedCalculator ? (
              <li><Link href={`/calculators/${article.relatedCalculator}`} className="underline underline-offset-4">{t("relatedCalculator")}: {tc(`names.${article.relatedCalculator}`)}</Link></li>
            ) : null}
            {article.relatedChapter ? (() => {
              const [track, mod, chapter] = article.relatedChapter.split("/");
              return <li><Link href={`/learn/${track}/${mod}/${chapter}`} className="underline underline-offset-4">{t("relatedChapter")}</Link></li>;
            })() : null}
          </ul>
        </section>
      ) : null}
      <div className="mt-10"><NewsletterSignup compact /></div>
    </article>
  );
}
