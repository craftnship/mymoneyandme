import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { Prose } from "@/components/Prose";

export async function generateMetadata() {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("intro") };
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
