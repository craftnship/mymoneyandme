import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Notice, PageTitle } from "@/components/ui";
import { pageAlternates } from "@/lib/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("newsletter");
  return { title: t("title"), description: t("pageIntro"), alternates: pageAlternates(locale, "/newsletter") };
}

/** Landing page for confirmation and unsubscribe links; the status comes from the query string. */
async function Status({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("newsletter");
  const status = (await searchParams).status;
  if (status !== "confirmed" && status !== "unsubscribed" && status !== "invalid") return null;
  return (
    <div className="mb-8">
      <Notice tone={status === "invalid" ? "warning" : "tip"}>
        {t(`status.${status}`)}{" "}
        <Link href="/" className="underline underline-offset-4">{t("backHome")}</Link>
      </Notice>
    </div>
  );
}

export default async function NewsletterPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("newsletter");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("title")} intro={t("pageIntro")} />
      <Suspense fallback={null}>
        <Status searchParams={searchParams} />
      </Suspense>
      <NewsletterSignup />
    </div>
  );
}
