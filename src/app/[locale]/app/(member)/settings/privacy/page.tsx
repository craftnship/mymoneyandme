import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { ConsentForm, DeletionForm, type ConsentRow } from "@/components/app/settings/PrivacyForms";
import { requireUser } from "@/lib/auth/current";
import { CONSENT_KINDS, currentConsents } from "@/lib/auth/users";
import { consentDecidedAt } from "@/lib/account/store";
import { GRACE_DAYS } from "@/lib/account/purge";

export async function generateMetadata() {
  const t = await getTranslations("appSettings");
  return { title: `${t("nav.privacy")} · ${t("title")}`, robots: { index: false } };
}

async function Privacy({ locale }: { locale: string }) {
  const user = await requireUser(locale);
  const [consents, decided] = await Promise.all([currentConsents(user.id), consentDecidedAt(user.id)]);
  const t = await getTranslations("appSettings.privacy");
  const f = await getFormatter();
  const when = (d: Date) => f.dateTime(d, { dateStyle: "medium" });
  const rows: ConsentRow[] = CONSENT_KINDS.map((kind) => ({ kind, granted: consents[kind], decidedAt: decided[kind] ? when(decided[kind]) : null }));
  const purgeOn = user.deletionRequestedAt ? new Date(new Date(user.deletionRequestedAt).getTime() + GRACE_DAYS * 24 * 3600 * 1000) : null;
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold">{t("consents")}</h2>
        <p className="mt-2 mb-2 text-sm text-fg-muted">{t("consentsIntro")}</p>
        <ConsentForm rows={rows} />
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t("export")}</h2>
        <p className="mt-2 mb-4 text-sm text-fg-muted">{t("exportIntro")}</p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/account/export" download className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong">{t("exportJson")}</a>
          <a href="/api/account/export?format=csv" download className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("exportCsv")}</a>
        </div>
        <p className="mt-3 text-xs text-fg-muted">{t("exportNote")}</p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t("delete")}</h2>
        <p className="mt-2 mb-4 text-sm text-fg-muted">{t("deleteIntro", { days: GRACE_DAYS })}</p>
        <DeletionForm pendingSince={purgeOn ? when(purgeOn) : null} />
      </Card>
    </div>
  );
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
      <Privacy locale={locale} />
    </Suspense>
  );
}
