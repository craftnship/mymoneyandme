import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta, routing } from "@/i18n/routing";
import { allArticles, availableLocales, getArticle, readingMinutes, resolveTranslation } from "@/lib/content/store";
import { BlockRenderer } from "@/components/BlockRenderer";
import type { Block } from "@/lib/content/types";
import { Notice, Pill } from "@/components/ui";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { pageAlternates } from "@/lib/seo";
import { resolvePlaceholders } from "@/lib/rulepack";

export async function generateStaticParams() {
  return (await allArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  const r = resolveTranslation(article.translations, locale);
  if (!r) return {};
  return {
    title: r.translation.seoTitle ?? r.translation.title,
    description: r.translation.seoDescription ?? r.translation.excerpt,
    alternates: pageAlternates(locale, `/articles/${article.slug}`, availableLocales(article.translations).filter((l) => (routing.locales as readonly string[]).includes(l))),
    openGraph: { type: "article", publishedTime: article.publishedAt, modifiedTime: article.updatedAt },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const r = resolveTranslation(article.translations, locale);
  if (!r) notFound();
  const t = await getTranslations("article");
  const tc = await getTranslations("calc");
  const th = await getTranslations("home");
  const f = await getFormatter();
  const { translation, fallback } = r;
  // Key takeaways lead the article, the way Investopedia opens with them; the body keeps everything else.
  const takeaways = translation.blocks.find((b): b is Extract<Block, { type: "takeaways" }> => b.type === "takeaways");
  const body = translation.blocks.filter((b) => b !== takeaways);
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
    <article className="reading-column mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill tone="accent">{t(`category.${article.category}`)}</Pill>
        <Pill>{t(`format.${article.format}`)}</Pill>
      </div>
      <h1 className="reading-title text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{translation.title}</h1>
      <p className="mt-3 text-lg text-fg-muted">{translation.excerpt}</p>
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
        <span>{t("by", { author: article.author })}</span>
        <span aria-hidden>·</span>
        <span>{article.updatedAt ? t("updatedOn", { date: f.dateTime(new Date(article.updatedAt), { dateStyle: "medium" }) }) : f.dateTime(new Date(article.publishedAt), { dateStyle: "medium" })}</span>
        <span aria-hidden>·</span>
        <span>{th("minRead", { minutes: readingMinutes(translation) })}</span>
      </p>
      {translation.aiDraft ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <Pill tone="warn">{t("aiTag")}</Pill>
          <a href={`mailto:hello@mymoneyandme.in?subject=Translation issue: ${article.slug} (${locale})`} className="underline underline-offset-4">{t("reportIssue")}</a>
        </p>
      ) : null}

      {fallback || langs.length > 1 ? (
        <div className="mt-4 space-y-3">
          {fallback ? (
            <Notice tone="warning">
              {t("notTranslated", { language: localeMeta(locale).nativeName, shown: localeMeta(r.locale).nativeName })}{" "}
              <a href={`mailto:hello@mymoneyandme.in?subject=Translation request: ${article.slug} (${locale})`} className="underline">{t("requestTranslation")}</a>
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
      ) : null}

      {article.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- covers are small SVG illustrations under /public
        <img src={article.cover} alt="" width={1200} height={675} className="mt-6 w-full aspect-[16/9] object-cover rounded-card border border-border" />
      ) : null}

      {takeaways ? (
        <section className="mt-6 rounded-card border border-accent/30 bg-accent-soft p-5">
          <h2 className="font-semibold">{t("takeaways")}</h2>
          <ul className="mt-2 list-disc ps-5 space-y-1.5">{takeaways.items.map((it, k) => <li key={k}>{resolvePlaceholders(it)}</li>)}</ul>
        </section>
      ) : null}

      <div className="mt-8">
        <BlockRenderer blocks={body} />
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
