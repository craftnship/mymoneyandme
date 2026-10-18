import { getTranslations } from "next-intl/server";
import { Notice, PageTitle } from "@/components/ui";
import { SignUpForm } from "@/components/app/AuthForms";

export async function generateMetadata() {
  const t = await getTranslations("app.auth");
  return { title: t("createAccount"), robots: { index: false } };
}

export default async function SignUpPage() {
  const t = await getTranslations("app.auth");
  return (
    <>
      <PageTitle title={t("signUpTitle")} intro={t("signUpIntro")} />
      <div className="mb-6"><Notice tone="info">{t("privacyNote")}</Notice></div>
      <SignUpForm />
    </>
  );
}
