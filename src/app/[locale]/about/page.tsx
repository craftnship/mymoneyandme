import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("about");
  return { title: t("title"), description: t("intro"), alternates: pageAlternates(locale, "/about") };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  return (
    <div className="max-w-3xl">
      <PageTitle title={t("title")} intro={t("intro")} />
      <Prose text={t("body")} />
    </div>
  );
}
