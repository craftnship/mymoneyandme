import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/current";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Status({ searchParams }: { searchParams: SearchParams }) {
  const status = (await searchParams).status;
  const t = await getTranslations("app.auth");
  if (status === "verified") return <div className="mb-6"><Notice tone="tip">{t("verified")}</Notice></div>;
  if (status === "invalid") return <div className="mb-6"><Notice tone="warning">{t("linkInvalid")}</Notice></div>;
  return null;
}

async function Welcome({ locale }: { locale: string }) {
  const user = await requireUser(locale);
  const t = await getTranslations("app.dashboard");
  return (
    <Card>
      <h2 className="text-xl font-semibold">{t("hello", { name: user.preferredName ?? user.name })}</h2>
      <p className="mt-2 text-fg-muted">{t("emptyBody")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/app/data" className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong">{t("startData")}</Link>
        <Link href="/app/settings" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("goSettings")}</Link>
      </div>
    </Card>
  );
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("app.dashboard");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={null}><Status searchParams={searchParams} /></Suspense>
      <Suspense fallback={null}><Welcome locale={locale} /></Suspense>
    </>
  );
}
