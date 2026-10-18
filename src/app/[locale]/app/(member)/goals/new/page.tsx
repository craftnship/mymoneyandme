import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listMembers } from "@/lib/data/store";
import { GoalForm } from "@/components/app/checkup/GoalForm";
import { isoDateFromNow } from "@/lib/checkup/progress";

export async function generateMetadata() {
  const t = await getTranslations("appCheckup.goals");
  return { title: t("newTitle") };
}

async function NewGoal({ locale }: { locale: string }) {
  const { household } = await requireHousehold(locale);
  const members = await listMembers(household.id);
  return (
    <Card>
      <GoalForm members={members.map((m) => ({ id: m.id, name: m.name }))} minDate={isoDateFromNow()} />
    </Card>
  );
}

export default async function NewGoalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appCheckup.goals");
  return (
    <div className="max-w-2xl">
      <p className="text-sm text-fg-muted mb-2"><Link href="/app/goals" className="underline underline-offset-4">{t("back")}</Link></p>
      <PageTitle title={t("newTitle")} intro={t("newIntro")} />
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
        <NewGoal locale={locale} />
      </Suspense>
    </div>
  );
}
