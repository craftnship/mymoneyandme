import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { completeness, completenessHref } from "@/lib/data/completeness";
import { listItems, listMembers } from "@/lib/data/store";
import { familyTotals, softWarnings, type SoftWarning } from "@/lib/data/summary";
import { dataQuality } from "@/lib/data/quality";
import { QualityList } from "@/components/app/data/QualityList";
import { formatINR, formatINRCompact } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("appData.overview");
  return { title: t("title"), robots: { index: false } };
}

/** Data overview (section 8): one card per family, members, completeness and soft warnings. */
export default async function DataPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appData");
  return (
    <>
      <PageTitle title={t("overview.title")} intro={t("overview.intro")} />
      <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
        <Body locale={locale} />
      </Suspense>
    </>
  );
}

function warningText(t: Awaited<ReturnType<typeof getTranslations<"appData">>>, w: SoftWarning): string {
  switch (w.kind) {
    case "expensesOverIncome": return t("overview.warning.expensesOverIncome", { income: formatINR(w.income), expenses: formatINR(w.expenses) });
    case "emiOverExpenses": return t("overview.warning.emiOverExpenses", { emi: formatINR(w.emi), expenses: formatINR(w.expenses) });
    case "lowLifeCover": return t("overview.warning.lowLifeCover", { cover: formatINRCompact(w.cover), target: formatINRCompact(w.target) });
  }
}

async function Body({ locale }: { locale: string }) {
  const { user, household } = await requireHousehold(locale);
  const [items, members] = await Promise.all([listItems(household.id), listMembers(household.id)]);
  const t = await getTranslations("appData");
  const totals = familyTotals(items);
  const warnings = softWarnings(items);
  const c = completeness(user, members, items);
  const issues = dataQuality(items);
  return (
    <div className="space-y-6">
      {warnings.length ? (
        <section aria-labelledby="warnings-title" className="space-y-2">
          <h2 id="warnings-title" className="text-sm font-semibold text-fg-muted">{t("overview.warnings")}</h2>
          {warnings.map((w) => <Notice key={w.kind} tone="warning">{warningText(t, w)}</Notice>)}
        </section>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-fg-muted">{t("overview.completeness")}</p>
            <p className="text-3xl font-semibold tabular-nums">{c.percent}%</p>
          </div>
          <p className="text-sm">
            {c.nextField ? (
              <Link href={completenessHref(c.nextField)} className="underline underline-offset-4">{t("overview.nextField", { field: t(`completeness.fields.${c.nextField}`) })}</Link>
            ) : t("overview.complete")}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full border border-border bg-bg" role="progressbar" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("overview.completeness")}>
          <div className="h-full bg-accent" style={{ width: `${c.percent}%` }} />
        </div>
      </Card>

      <QualityList issues={issues} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map((f) => (
          <Card key={f.family}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold"><Link href={`/app/data/${f.family}`} className="hover:underline underline-offset-4">{t(`families.${f.family}.title`)}</Link></h2>
              <span className="text-xs text-fg-muted">{t("overview.items", { count: f.count })}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{f.count ? formatINRCompact(f.total) : t("common.none")}</p>
            <p className="text-xs text-fg-muted">{t(`families.${f.family}.unit`)}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link href={`/app/data/${f.family}/new`} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-strong">{t("common.add")}</Link>
              <Link href={`/app/data/${f.family}`} className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-accent-soft">{t("overview.manage")}</Link>
            </div>
          </Card>
        ))}
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold"><Link href="/app/data/members" className="hover:underline underline-offset-4">{t("overview.members")}</Link></h2>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{t("overview.membersCount", { count: members.length })}</p>
          <p className="text-xs text-fg-muted">{members.filter((m) => m.relation !== "self").map((m) => m.name).join(", ") || t("common.none")}</p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/app/data/members/new" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-strong">{t("common.add")}</Link>
            <Link href="/app/data/members" className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-accent-soft">{t("overview.manage")}</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
