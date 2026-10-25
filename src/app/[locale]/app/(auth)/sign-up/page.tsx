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
      <section aria-labelledby="signup-what" className="mb-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
        <h2 id="signup-what" className="font-semibold">{t("signUpWhat")}</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>{t("signUpBenefit1")}</li>
          <li>{t("signUpBenefit2")}</li>
          <li>{t("signUpBenefit3")}</li>
        </ul>
      </section>
      <SignUpForm />
      <div className="mt-6"><Notice tone="info">{t("privacyNote")}</Notice></div>
    </>
  );
}
