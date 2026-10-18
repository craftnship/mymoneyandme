import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui";
import { ForgotForm } from "@/components/app/AuthForms";

export async function generateMetadata() {
  const t = await getTranslations("app.auth");
  return { title: t("forgotTitle"), robots: { index: false } };
}

export default async function ForgotPage() {
  const t = await getTranslations("app.auth");
  return (
    <>
      <PageTitle title={t("forgotTitle")} intro={t("forgotIntro")} />
      <ForgotForm />
    </>
  );
}
