import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageTitle } from "@/components/ui";
import { MemberForm } from "@/components/app/data/MemberForm";
import { requireHousehold } from "@/lib/auth/current";
import { listMembers } from "@/lib/data/store";


export async function generateMetadata() {
  const t = await getTranslations("appData.members");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditMemberPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations("appData");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("members.edit")} />
      <Card>
        <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
          <Body locale={locale} id={id} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Body({ locale, id }: { locale: string; id: string }) {
  const { household } = await requireHousehold(locale);
  const member = (await listMembers(household.id)).find((m) => m.id === id);
  if (!member || member.relation === "self") notFound();
  return <MemberForm defaults={{ id: member.id, name: member.name, relation: member.relation, dob: member.dob, earns: member.earns, dependant: member.dependant }} />;
}
