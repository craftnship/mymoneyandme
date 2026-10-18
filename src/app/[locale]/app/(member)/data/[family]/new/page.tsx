import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageTitle } from "@/components/ui";
import { ItemForm } from "@/components/app/data/ItemForm";
import { requireHousehold } from "@/lib/auth/current";
import { FAMILIES, isFamily, type Family } from "@/lib/data/model";
import { formOptions } from "@/lib/data/options";

type Params = Promise<{ locale: string; family: string }>;

export function generateStaticParams() {
  return FAMILIES.map((family) => ({ family }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { family } = await params;
  if (!isFamily(family)) return {};
  const t = await getTranslations("appData");
  return { title: t("items.new", { family: t(`families.${family}.one`) }), robots: { index: false } };
}

export default async function NewItemPage({ params }: { params: Params }) {
  const { locale, family } = await params;
  if (!isFamily(family)) notFound();
  const t = await getTranslations("appData");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("items.new", { family: t(`families.${family}.one`) })} />
      <Card>
        <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
          <Body locale={locale} family={family} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Body({ locale, family }: { locale: string; family: Family }) {
  const { household } = await requireHousehold(locale);
  const { members, loans } = await formOptions(household.id, family);
  return <ItemForm family={family} members={members} loans={loans} />;
}
