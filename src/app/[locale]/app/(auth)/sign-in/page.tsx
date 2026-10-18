import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Notice, PageTitle } from "@/components/ui";
import { SignInForm } from "@/components/app/AuthForms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("app.auth");
  return { title: t("signIn"), robots: { index: false } };
}

async function Inner({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const t = await getTranslations("app.auth");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  return (
    <>
      {status === "deletionScheduled" ? <div className="mb-6"><Notice tone="tip">{t("deletionScheduled")}</Notice></div> : null}
      {status === "signedOut" ? <div className="mb-6"><Notice tone="info">{t("sessionEnded")}</Notice></div> : null}
      <SignInForm next={next} />
    </>
  );
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("app.auth");
  return (
    <>
      <PageTitle title={t("signInTitle")} intro={t("signInIntro")} />
      <Suspense fallback={null}>
        <Inner searchParams={searchParams} />
      </Suspense>
    </>
  );
}
