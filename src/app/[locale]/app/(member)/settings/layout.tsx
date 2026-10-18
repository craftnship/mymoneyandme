import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { SettingsNav } from "@/components/app/settings/SettingsNav";

/** Static settings shell: title and sub-navigation prerender; each page streams its own data behind Suspense. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("appSettings");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <SettingsNav />
      {children}
    </>
  );
}
