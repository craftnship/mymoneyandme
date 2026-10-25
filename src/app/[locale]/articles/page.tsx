import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { allArticles, resolveTranslation } from "@/lib/content/store";
import { localeMeta } from "@/i18n/routing";
import { ARTICLE_CATEGORIES, normaliseArticleQuery, searchArticles, type ArticleQuery } from "@/lib/content/search";
import { ArticleCard } from "@/components/ArticleCard";
import { PageTitle } from "@/components/ui";
import { pageAlternates } from "@/lib/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("article");
  return { title: t("allArticles"), description: t("listDescription"), alternates: pageAlternates(locale, "/articles") };
}

/**
 * The feed with search and category filters (section 4). Filters are plain
 * query-string state so a filtered view is shareable and works without
 * JavaScript. Reading searchParams is request-time work, so the filtered list
 * sits in its own Suspense boundary and the full feed is the static fallback.
 */
async function FilteredFeed({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const query = normaliseArticleQuery(await searchParams);
  return <Feed locale={locale} query={query} />;
}

async function Feed({ locale, query }: { locale: string; query: ArticleQuery }) {
  const t = await getTranslations("article");
  const results = searchArticles(await allArticles(), locale, query);
  const filtered = Boolean(query.q || query.category);
  // Articles in the reader's language come first; untranslated ones follow under their own heading rather than
  // being mixed in with a small "English" pill, so a Tamil reader sees what is actually in Tamil at a glance.
  const inLocale = results.filter((a) => !resolveTranslation(a.translations, locale)?.fallback);
  const fallbacks = results.filter((a) => resolveTranslation(a.translations, locale)?.fallback);
  const split = locale !== "en" && inLocale.length > 0 && fallbacks.length > 0;
  return (
    <div>
      <Filters query={query} />
      {filtered ? (
        <p className="mb-4 text-sm text-fg-muted" aria-live="polite">
          {t("resultsCount", { count: results.length })}
          {" · "}
          <Link href="/articles" className="underline underline-offset-4">{t("clearFilters")}</Link>
        </p>
      ) : null}
      {results.length === 0 ? (
        <p className="rounded-card border border-border bg-bg-elevated p-6 text-fg-muted">{t("noResults")}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {(split ? inLocale : results).map((a) => <ArticleCard key={a.id} article={a} locale={locale} heading="h2" />)}
          </div>
          {split ? (
            <section aria-labelledby="more-in-english" className="mt-10">
              <h2 id="more-in-english" className="text-xl font-semibold">{t("moreInEnglish")}</h2>
              <p className="mt-1 mb-4 text-sm text-fg-muted">{t("moreInEnglishIntro", { language: localeMeta(locale).nativeName })}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {fallbacks.map((a) => <ArticleCard key={a.id} article={a} locale={locale} heading="h3" />)}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

async function Filters({ query }: { query: ArticleQuery }) {
  const t = await getTranslations("article");
  return (
    <div className="mb-6 space-y-4">
      <form method="get" action="" role="search" className="flex flex-wrap gap-2">
        <label htmlFor="article-search" className="sr-only">{t("searchLabel")}</label>
        <input
          id="article-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2"
        />
        {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{t("searchButton")}</button>
      </form>
      <nav aria-label={t("filterByCategory")} className="flex flex-wrap gap-2">
        <FilterChip href={query.q ? `/articles?q=${encodeURIComponent(query.q)}` : "/articles"} active={!query.category}>{t("filterAll")}</FilterChip>
        {ARTICLE_CATEGORIES.map((c) => {
          const params = new URLSearchParams();
          if (query.q) params.set("q", query.q);
          params.set("category", c);
          return (
            <FilterChip key={c} href={`/articles?${params.toString()}`} active={query.category === c}>{t(`category.${c}`)}</FilterChip>
          );
        })}
      </nav>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-soft text-accent-strong font-medium" : "border-border hover:bg-bg-elevated"}`}
    >
      {children}
    </Link>
  );
}

export default async function ArticlesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("article");
  return (
    <div>
      <PageTitle title={t("allArticles")} />
      <Suspense fallback={<Feed locale={locale} query={{}} />}>
        <FilteredFeed locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
