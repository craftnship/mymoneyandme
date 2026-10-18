import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getRulePack } from "@/lib/rulepack";
import { PageTitle } from "@/components/ui";

const PAGES = ["disclaimer", "privacy", "terms", "grievance", "accessibility"] as const;
type Page = (typeof PAGES)[number];

export function generateStaticParams() {
  return PAGES.map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!PAGES.includes(page as Page)) return {};
  const t = await getTranslations("legal");
  return { title: t(page as Page) };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  if (!PAGES.includes(page as Page)) notFound();
  const p = page as Page;
  const t = await getTranslations("legal");
  const pack = getRulePack();
  return (
    <div className="max-w-3xl">
      <PageTitle title={t(p)} />
      <p className="leading-relaxed">{t(`${p}Body`)}</p>
      {p === "disclaimer" ? <p className="mt-6 text-sm text-fg-muted">{pack.disclaimer[locale] ?? pack.disclaimer.en}</p> : null}
    </div>
  );
}
