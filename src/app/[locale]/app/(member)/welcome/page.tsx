import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { QuickStartForm } from "@/components/app/data/QuickStartForm";
import { requireHousehold } from "@/lib/auth/current";
import { runQuickCheck } from "@/lib/checkup/engine";
import { ageFromDob } from "@/lib/data/forms";
import { listItems } from "@/lib/data/store";
import { amountOf } from "@/lib/data/summary";
import { formatINR, formatPercent } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("appData.welcome");
  return { title: t("title"), robots: { index: false } };
}

/**
 * Onboarding quick start (section 7): the minimum needed for a first score.
 * Once the household has income data the page hands over to the dashboard,
 * except right after submit (?look=1) and when editing the profile (?edit=1).
 */
export default async function WelcomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("appData");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("welcome.title")} />
      <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
        <Body locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const { user, household } = await requireHousehold(locale);
  const sp = await searchParams;
  const items = await listItems(household.id);
  const income = items.filter((i) => i.family === "income");
  const expenses = items.filter((i) => i.family === "expenses");
  const hasIncome = income.length > 0;
  const look = sp.look === "1";
  const edit = sp.edit === "1";
  if (hasIncome && !look && !edit) redirect({ href: "/app", locale });
  const t = await getTranslations("appData");

  if (hasIncome && look) {
    const monthlyIncome = income.reduce((s, i) => s + amountOf(i), 0);
    const monthlyExpenses = expenses.reduce((s, i) => s + amountOf(i), 0);
    const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;
    const result = runQuickCheck({ age: ageFromDob(user.dob) ?? 32, monthlyIncome, monthlyExpenses, emergencySavings: 0, monthlyEmi: 0, hasTermCover: false, hasHealthCover: false });
    const tc = await getTranslations("checkup");
    return (
      <div className="space-y-6">
        <Notice tone="info">{t("welcome.look.approx")}</Notice>
        <h2 className="text-xl font-semibold">{t("welcome.look.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-fg-muted">{t("welcome.look.savingsRate")}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{formatPercent(savingsRate)}</p>
            <p className="mt-2 text-xs text-fg-muted">{t("welcome.look.savingsRateHint")} {formatINR(monthlyIncome - monthlyExpenses)} {t("common.perMonth")}.</p>
          </Card>
          <Card>
            <p className="text-sm text-fg-muted">{t("welcome.look.emergency")}</p>
            <p className="mt-1 text-3xl font-semibold">{t("welcome.look.emergencyUnknown")}</p>
            <p className="mt-2 text-xs text-fg-muted">{t("welcome.look.emergencyHint")}</p>
          </Card>
          <Card>
            <p className="text-sm text-fg-muted">{t("welcome.look.score")} · {tc("approximate")}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{result.overall}</p>
            <p className="mt-2 text-xs text-fg-muted">{t("welcome.look.scoreHint", { grade: tc(`grade.${result.grade}` as "grade.good") })}</p>
          </Card>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/data" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{t("welcome.look.addData")}</Link>
          <Link href="/app" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("welcome.look.dashboard")}</Link>
        </div>
      </div>
    );
  }

  const editing = hasIncome && edit;
  return (
    <Card>
      <p className="mb-5 text-fg-muted">{editing ? t("welcome.editIntro") : t("welcome.intro")}</p>
      <QuickStartForm
        edit={editing}
        defaults={{
          dob: user.dob, gender: user.gender, maritalStatus: user.maritalStatus, dependants: user.dependants, city: user.city, state: user.state,
          pin: user.pin, cityTier: user.cityTier, employment: user.employment,
        }}
      />
    </Card>
  );
}
