import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { allArticles } from "@/lib/content/store";
import { CALCULATORS } from "@/lib/calculators";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Card } from "@/components/ui";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const tc = await getTranslations("calc");
  const articles = allArticles();
  const hero = articles.find((a) => a.pinned) ?? articles[0];
  const rest = articles.filter((a) => a !== hero);
  const featured = CALCULATORS.filter((c) => c.featured);
  const tracks = ["adults", "kids", "women"] as const;

  return (
    <div className="space-y-14">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">{t("heroTitle")}</h1>
          <p className="mt-4 text-lg text-fg-muted max-w-xl">{t("heroBody")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/learn" className="rounded-lg bg-accent text-white px-5 py-2.5 font-medium hover:bg-accent-strong">{t("startLearning")}</Link>
            <Link href="/check-up" className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-accent-soft">{t("runCheckup")}</Link>
          </div>
        </div>
        {hero ? <ArticleCard article={hero} locale={locale} large heading="h2" /> : null}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t("latest")}</h2>
          <Link href="/articles" className="text-sm text-accent-strong hover:underline underline-offset-4">{(await getTranslations("article"))("allArticles")}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {rest.slice(0, 3).map((a) => <ArticleCard key={a.id} article={a} locale={locale} />)}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">{t("tracks")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tracks.map((tr) => (
            <Link key={tr} href={`/learn/${tr}`} className="block">
              <Card className="h-full hover:border-accent transition-colors">
                <h3 className="text-xl font-semibold">{t(`track${tr[0].toUpperCase()}${tr.slice(1)}` as "trackAdults")}</h3>
                <p className="mt-2 text-fg-muted">{t(`track${tr[0].toUpperCase()}${tr.slice(1)}Body` as "trackAdultsBody")}</p>
              </Card>
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
