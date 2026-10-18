import { getTranslations } from "next-intl/server";
import { Card, PageTitle } from "@/components/ui";
import { MemberForm } from "@/components/app/data/MemberForm";

export async function generateMetadata() {
  const t = await getTranslations("appData.members");
  return { title: t("new"), robots: { index: false } };
}

/** New member: the form needs no household data, so the page is fully static; the action checks the session. */
export default async function NewMemberPage() {
  const t = await getTranslations("appData.members");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("new")} />
      <Card>
        <MemberForm defaults={{ name: "", relation: "spouse", dob: null, earns: false, dependant: false }} />
      </Card>
    </div>
  );
}
