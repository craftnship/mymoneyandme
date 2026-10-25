import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { QuickCheck } from "@/components/QuickCheck";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("checkup");
  return { title: t("title"), description: t("quickIntro"), alternates: pageAlternates(locale, "/check-up") };
}

export default async function CheckUpPage() {
  const t = await getTranslations("checkup");
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title={t("quickTitle")} intro={t("quickIntro")} />
      <QuickCheck />
    </div>
  );
}
