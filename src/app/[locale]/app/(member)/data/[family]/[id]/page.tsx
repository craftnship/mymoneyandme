import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageTitle } from "@/components/ui";
import { ItemForm } from "@/components/app/data/ItemForm";
import { requireHousehold } from "@/lib/auth/current";
import { isFamily, type Family } from "@/lib/data/model";
import { formOptions } from "@/lib/data/options";
import { getItem } from "@/lib/data/store";

type Params = Promise<{ locale: string; family: string; id: string }>;


export async function generateMetadata({ params }: { params: Params }) {
  const { family } = await params;
  if (!isFamily(family)) return {};
  const t = await getTranslations("appData");
  return { title: t("items.edit", { family: t(`families.${family}.one`) }), robots: { index: false } };
}

export default async function EditItemPage({ params }: { params: Params }) {
  const { locale, family, id } = await params;
  if (!isFamily(family)) notFound();
  const t = await getTranslations("appData");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("items.edit", { family: t(`families.${family}.one`) })} />
      <Card>
        <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
          <Body locale={locale} family={family} id={id} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Body({ locale, family, id }: { locale: string; family: Family; id: string }) {
  const { household } = await requireHousehold(locale);
  const item = await getItem(household.id, id);
  if (!item || item.family !== family) notFound();
  const { members, loans } = await formOptions(household.id, family);
  return <ItemForm family={family} members={members} loans={loans} values={{ id: item.id, type: item.type, memberId: item.memberId, confidence: item.confidence, payload: item.payload as Record<string, unknown> }} />;
}
