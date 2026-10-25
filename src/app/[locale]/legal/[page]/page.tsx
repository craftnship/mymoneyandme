import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getRulePack } from "@/lib/rulepack";
import { PageTitle } from "@/components/ui";
import { Prose } from "@/components/Prose";

const PAGES = ["disclaimer", "privacy", "terms", "grievance", "accessibility"] as const;
type Page = (typeof PAGES)[number];

/** Date shown at the top of every legal page; bump it when any of the texts change. */
const LEGAL_UPDATED = "2026-10-25";

export function generateStaticParams() {
  return PAGES.map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!PAGES.includes(page as Page)) return {};
  const t = await getTranslations("legal");
  const body = t(`${page as Page}Body`);
  return { title: t(page as Page), description: body.split(/\n/)[0].slice(0, 160) };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  if (!PAGES.includes(page as Page)) notFound();
  const p = page as Page;
  const t = await getTranslations("legal");
  const f = await getFormatter();
  const pack = getRulePack();
  return (
    <div className="max-w-3xl">
      <PageTitle title={t(p)} />
      <p className="-mt-5 mb-6 text-sm text-fg-muted">{t("updated", { date: f.dateTime(new Date(LEGAL_UPDATED), { dateStyle: "long" }) })}</p>
      <Prose text={t(`${p}Body`)} />
      {p === "disclaimer" ? <p className="mt-6 text-sm text-fg-muted">{pack.disclaimer[locale] ?? pack.disclaimer.en}</p> : null}
      <p className="mt-10 text-sm text-fg-muted">{t("contactLine")}</p>
    </div>
  );
}
