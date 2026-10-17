import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { QuickCheck } from "@/components/QuickCheck";

export async function generateMetadata() {
  const t = await getTranslations("checkup");
  return { title: t("title"), description: t("quickIntro") };
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
