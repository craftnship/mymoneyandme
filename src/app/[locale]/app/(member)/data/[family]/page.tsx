import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { archiveItemAction } from "@/lib/data/actions";
import { FAMILIES, isFamily, type Family } from "@/lib/data/model";
import { listItems, listMembers } from "@/lib/data/store";
import { amountOf } from "@/lib/data/summary";
import { formatINR } from "@/lib/format";

type Params = Promise<{ locale: string; family: string }>;

export function generateStaticParams() {
  return FAMILIES.map((family) => ({ family }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { family } = await params;
  if (!isFamily(family)) return {};
  const t = await getTranslations("appData.families");
  return { title: t(`${family}.title`), robots: { index: false } };
}

/** Items of one family (section 8): type, amount, member, confidence, edit and archive. */
export default async function FamilyPage({ params }: { params: Params }) {
  const { locale, family } = await params;
  if (!isFamily(family)) notFound();
  const t = await getTranslations("appData");
  const one = t(`families.${family}.one`);
  return (
    <div className="max-w-3xl">
      <PageTitle title={t(`families.${family}.title`)} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href={`/app/data/${family}/new`} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{t("items.add", { family: one })}</Link>
        <Link href="/app/data" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("common.back")}</Link>
      </div>
      <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
        <List locale={locale} family={family} />
      </Suspense>
    </div>
  );
}

async function List({ locale, family }: { locale: string; family: Family }) {
  const { household } = await requireHousehold(locale);
  const [items, members] = await Promise.all([listItems(household.id, family), listMembers(household.id)]);
  const t = await getTranslations("appData");
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const confidenceTone = { estimate: "warn", entered: "neutral", imported: "neutral", verified: "accent" } as const;
  if (!items.length) return <Card><p className="text-sm text-fg-muted">{t("items.empty")}</p></Card>;
  return (
    <Card className="p-0">
      <ul className="divide-y divide-border">
        {items.map((it) => {
          const label = typeof it.payload.label === "string" ? it.payload.label : "";
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(`types.${family}.${it.type}` as "types.income.salary")}{label ? <span className="font-normal text-fg-muted"> · {label}</span> : null}</p>
                <p className="text-sm text-fg-muted">{it.memberId ? memberName.get(it.memberId) ?? t("common.none") : t("items.household")}</p>
              </div>
              <p className="text-lg font-semibold tabular-nums">{formatINR(amountOf(it))}<span className="ms-1 text-xs font-normal text-fg-muted">{t(`families.${family}.unit`)}</span></p>
              <Pill tone={confidenceTone[it.confidence]}>{t(`options.confidence.${it.confidence}`)}</Pill>
              <div className="flex items-center gap-2 text-sm">
                <Link href={`/app/data/${family}/${it.id}`} className="rounded-lg border border-border px-3 py-1 hover:bg-accent-soft">{t("common.edit")}</Link>
                <form action={archiveItemAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="family" value={family} />
                  <input type="hidden" name="id" value={it.id} />
                  <button type="submit" className="rounded-lg border border-border px-3 py-1 text-danger hover:bg-danger-soft">{t("common.archive")}</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
