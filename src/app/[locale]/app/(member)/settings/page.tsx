import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, Notice } from "@/components/ui";
import { ProfileForm, type ProfileValues } from "@/components/app/settings/ProfileForm";
import { requireUser } from "@/lib/auth/current";
import { getHealthFlags } from "@/lib/account/store";
import { isRiskProfile } from "@/lib/account/profile";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("appSettings");
  return { title: `${t("nav.profile")} · ${t("title")}`, robots: { index: false } };
}

function flag(v: boolean | null): "" | "yes" | "no" {
  return v === null ? "" : v ? "yes" : "no";
}

async function Status({ searchParams }: { searchParams: SearchParams }) {
  const status = (await searchParams).status;
  const t = await getTranslations("appSettings.profile");
  if (status === "language") return <div className="mb-6"><Notice tone="tip">{t("languageChanged")}</Notice></div>;
  return null;
}

async function Profile({ locale }: { locale: string }) {
  const user = await requireUser(locale);
  const health = await getHealthFlags(user.id);
  const initial: ProfileValues = {
    name: user.name, preferredName: user.preferredName ?? "", dob: user.dob ?? "", gender: user.gender ?? "", maritalStatus: user.maritalStatus ?? "",
    city: user.city ?? "", state: user.state ?? "", pin: user.pin ?? "", cityTier: String(user.cityTier), locale: user.locale, numberFormat: user.numberFormat,
    employment: user.employment, retirementAge: user.retirementAge ? String(user.retirementAge) : "", riskProfile: isRiskProfile(user.riskProfile) ? user.riskProfile : null,
    smoker: flag(health.smoker), existingConditions: flag(health.existingConditions),
  };
  return (
    <Card>
      <ProfileForm initial={initial} />
    </Card>
  );
}

export default async function ProfileSettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const t = await getTranslations("common");
  return (
    <>
      <Suspense fallback={null}><Status searchParams={searchParams} /></Suspense>
      <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}><Profile locale={locale} /></Suspense>
    </>
  );
}
