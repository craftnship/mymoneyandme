import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Notice, PageTitle } from "@/components/ui";
import { ResetForm } from "@/components/app/AuthForms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("app.auth");
  return { title: t("resetTitle"), robots: { index: false } };
}

async function Inner({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("app.auth");
  const token = (await searchParams).token;
  if (typeof token !== "string" || !token) {
    return (
      <Notice tone="warning">
        {t("resetMissing")} <Link href="/app/forgot" className="underline underline-offset-4">{t("forgotTitle")}</Link>
      </Notice>
    );
  }
  return <ResetForm token={token} />;
}

export default async function ResetPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("app.auth");
  return (
    <>
      <PageTitle title={t("resetTitle")} intro={t("resetIntro")} />
      <Suspense fallback={null}>
        <Inner searchParams={searchParams} />
      </Suspense>
    </>
  );
}
