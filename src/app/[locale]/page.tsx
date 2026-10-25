import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { allArticles, allNews } from "@/lib/content/store";
import { CALCULATORS } from "@/lib/calculators";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsTicker } from "@/components/NewsTicker";
import { NewsList } from "@/components/NewsList";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { jsonLd, pageAlternates } from "@/lib/seo";

const TRACK_IMAGES = { adults: "/images/home/track-adults.svg", kids: "/images/home/track-kids.svg", women: "/images/home/track-women.svg" } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { alternates: pageAlternates(locale, "") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ts = await getTranslations("site");
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in";
  const structured = jsonLd({
    "@graph": [
      { "@type": "Organization", "@id": `${base}/#org`, name: ts("name"), url: base, logo: `${base}/icon.svg`, email: "hello@mymoneyandme.in" },
      {
        "@type": "WebSite",
        "@id": `${base}/#site`,
        name: ts("name"),
        description: ts("description"),
        url: `${base}/${locale}`,
        inLanguage: locale,
        publisher: { "@id": `${base}/#org` },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/${locale}/articles?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
    ],
  });
  const t = await getTranslations("home");
  const tc = await getTranslations("calc");
  const articles = await allArticles();
  const news = (await allNews()).slice(0, 5);
  const lead = articles.find((a) => a.pinned) ?? articles[0];
  const rest = articles.filter((a) => a !== lead);
  const featured = CALCULATORS.filter((c) => c.featured);
  const tracks = ["adults", "kids", "women"] as const;

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <NewsTicker items={news} locale={locale} />

      <section className="relative overflow-hidden rounded-card border border-border bg-accent-soft grid lg:grid-cols-[1.05fr_1fr] items-center">
        <div className="p-6 sm:p-10 order-last lg:order-none">
          <h1 className="hero-title text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">{t("heroTitle")}</h1>
          <p className="mt-4 text-lg text-fg-muted max-w-xl">{t("heroBody")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/learn" className="rounded-lg bg-accent text-white px-5 py-2.5 font-medium hover:bg-accent-strong">{t("startLearning")}</Link>
            <Link href="/check-up" className="rounded-lg border border-accent/40 bg-bg-elevated px-5 py-2.5 font-medium hover:bg-bg">{t("runCheckup")}</Link>
          </div>
        </div>
        <Image src="/images/home/hero.svg" alt="" width={1200} height={900} unoptimized priority className="w-full h-full max-h-[420px] lg:max-h-[520px] object-cover" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
        {lead ? (
          <section aria-labelledby="lead-heading">
            <h2 id="lead-heading" className="text-sm font-semibold uppercase tracking-wider text-fg-muted mb-3">{t("topStory")}</h2>
            <ArticleCard article={lead} locale={locale} large />
          </section>
        ) : null}
        {news.length > 0 ? <NewsList items={news} locale={locale} /> : null}
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t("latest")}</h2>
          <Link href="/articles" className="text-sm text-accent-strong hover:underline underline-offset-4">{(await getTranslations("article"))("allArticles")}</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {rest.slice(0, 3).map((a) => <ArticleCard key={a.id} article={a} locale={locale} />)}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">{t("tracks")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {tracks.map((tr) => (
            <Link key={tr} href={`/learn/${tr}`} className="group block rounded-card border border-border bg-bg-elevated overflow-hidden hover:border-accent transition-colors">
              <Image src={TRACK_IMAGES[tr]} alt="" width={800} height={450} unoptimized className="w-full aspect-[16/9] object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-semibold group-hover:underline underline-offset-4">{t(`track${tr[0].toUpperCase()}${tr.slice(1)}` as "trackAdults")}</h3>
                <p className="mt-2 text-fg-muted">{t(`track${tr[0].toUpperCase()}${tr.slice(1)}Body` as "trackAdultsBody")}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t("featuredCalculators")}</h2>
          <Link href="/calculators" className="text-sm text-accent-strong hover:underline underline-offset-4">{t("allCalculators", { count: CALCULATORS.length })}</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => (
            <Link key={c.slug} href={`/calculators/${c.slug}`} className="rounded-card border border-border bg-bg-elevated p-4 hover:border-accent transition-colors">
              <p className="font-medium">{tc(`names.${c.slug}`)}</p>
              <p className="text-xs text-fg-muted mt-1">{tc(`group.${c.group}`)}</p>
            </Link>
          ))}
        </div>
      </section>

      <NewsletterSignup />
    </div>
  );
}
