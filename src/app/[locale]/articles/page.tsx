import { getTranslations } from "next-intl/server";
import { allArticles } from "@/lib/content/store";
import { ArticleCard } from "@/components/ArticleCard";
import { PageTitle } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("article");
  return { title: t("allArticles") };
}

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("article");
  return (
    <div>
      <PageTitle title={t("allArticles")} />
      <div className="grid gap-4 md:grid-cols-2">
        {allArticles().map((a) => <ArticleCard key={a.id} article={a} locale={locale} />)}
      </div>
    </div>
  );
}
