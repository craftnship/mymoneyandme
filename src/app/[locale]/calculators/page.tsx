import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CALCULATORS, CALCULATOR_GROUPS } from "@/lib/calculators";
import { PageTitle } from "@/components/ui";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("calc");
  return { title: t("title"), description: t("intro"), alternates: pageAlternates(locale, "/calculators") };
}

export default async function CalculatorsPage() {
  const t = await getTranslations("calc");
  return (
    <div>
      <PageTitle title={`${t("title")} · ${t("count", { count: CALCULATORS.length })}`} intro={t("intro")} />
      <div className="space-y-10">
        {CALCULATOR_GROUPS.map((g) => {
          const items = CALCULATORS.filter((c) => c.group === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="text-xl font-semibold mb-3">{t(`group.${g}`)}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/calculators/${c.slug}`} className="block rounded-xl border border-border bg-bg-elevated px-4 py-3 hover:border-accent transition-colors">
                      {t(`names.${c.slug}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
