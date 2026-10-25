import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CALCULATORS, calculatorDescription, decodeInputs, getCalculator, type CalculatorDef } from "@/lib/calculators";
import { allArticles, resolveTranslation } from "@/lib/content/store";
import { CalculatorEmbed } from "@/components/CalculatorEmbed";
import { jsonLd, pageAlternates } from "@/lib/seo";

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const def = getCalculator(slug);
  if (!def) return {};
  const t = await getTranslations("calc");
  return { title: t(`names.${slug}`), description: calculatorDescription(def, t), alternates: pageAlternates(locale, `/calculators/${slug}`) };
}

/**
 * Shareable URLs encode inputs (section 6). Reading searchParams is request-time
 * work, so it lives in its own Suspense boundary: the static shell renders the
 * calculator on defaults and the shared inputs stream in.
 */
async function SharedCalculator({ def, searchParams }: { def: CalculatorDef; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = decodeInputs(def, await searchParams);
  return <CalculatorEmbed slug={def.slug} initial={initial} full />;
}

export default async function CalculatorPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, slug } = await params;
  const def = getCalculator(slug);
  if (!def) notFound();
  const t = await getTranslations("calc");
  const ta = await getTranslations("article");
  const related = def.relatedArticle ? allArticles().find((a) => a.slug === def.relatedArticle) : undefined;
  const relatedT = related ? resolveTranslation(related.translations, locale) : undefined;
  const siblings = CALCULATORS.filter((c) => c.group === def.group && c.slug !== def.slug).slice(0, 6);
  const structured = jsonLd({
    "@type": "WebApplication",
    name: t(`names.${slug}`),
    description: calculatorDescription(def, t),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    inLanguage: locale,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    provider: { "@type": "Organization", name: "My Money & Me" },
  });

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <p className="text-sm text-fg-muted">
        <Link href="/calculators" className="underline underline-offset-4">{t("title")}</Link> / {t(`group.${def.group}`)}
      </p>
      <Suspense fallback={<CalculatorEmbed slug={slug} full />}>
        <SharedCalculator def={def} searchParams={searchParams} />
      </Suspense>
      {(related || def.relatedChapter) ? (
        <section className="rounded-card border border-border p-5">
          <p className="font-semibold">{t("whatItMeans")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {related && relatedT ? <li><Link href={`/articles/${related.slug}`} className="underline underline-offset-4">{relatedT.translation.title}</Link></li> : null}
            {def.relatedChapter ? (() => {
              const [track, mod, chapter] = def.relatedChapter.split("/");
              return <li><Link href={`/learn/${track}/${mod}/${chapter}`} className="underline underline-offset-4">{ta("relatedChapter")}</Link></li>;
            })() : null}
          </ul>
        </section>
      ) : null}
      {siblings.length ? (
        <section>
          <h2 className="font-semibold mb-2">{t("related")}</h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((c) => (
              <li key={c.slug}><Link href={`/calculators/${c.slug}`} className="inline-block rounded-full border border-border px-3 py-1 text-sm hover:bg-accent-soft">{t(`names.${c.slug}`)}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
