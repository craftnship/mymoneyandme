import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Notice, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { listItems } from "@/lib/data/store";
import { netWorthBreakdown, type AssetCategory } from "@/lib/snapshots/compute";
import { formatINR, formatINRCompact } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("appDashboard.netWorth");
  return { title: t("title"), robots: { index: false } };
}

export default async function NetWorthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appDashboard.netWorth");
  const tc = await getTranslations("common");
  return (
    <>
      <PageTitle title={t("title")} intro={t("intro")} />
      <Suspense fallback={<p className="text-fg-muted">{tc("loading")}</p>}>
        <Body locale={locale} />
      </Suspense>
    </>
  );
}

const pct = (share: number) => Math.round(share * 100);

/** Net worth view (spec section 13): allocation, liquid against illiquid, concentration, liabilities and the liquid net worth rule written out. */
async function Body({ locale }: { locale: string }) {
  const { household } = await requireHousehold(locale);
  const t = await getTranslations("appDashboard.netWorth");
  const td = await getTranslations("appData");
  const items = await listItems(household.id);
  const b = netWorthBreakdown(items);
  const th = "px-3 py-2 text-start font-medium text-fg-muted";
  const td2 = "px-3 py-2 tabular-nums";
  const categoryName = (c: AssetCategory) => t(`category.${c}`);

  if (!b.categories.length && !b.loans.length) {
    return (
      <Card>
        <p className="text-fg-muted">{t("empty")}</p>
        <p className="mt-3"><Link href="/app/data/assets/new" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{t("addAssets")}</Link></p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <dl className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-fg-muted">{t("assets")}</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{formatINRCompact(b.assets)}</dd></div>
          <div><dt className="text-xs text-fg-muted">{t("liabilities")}</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{formatINRCompact(b.liabilities)}</dd></div>
          <div className="border-s-2 border-accent ps-3"><dt className="text-xs text-fg-muted">{t("netWorth")}</dt><dd className={`mt-0.5 text-2xl font-semibold tabular-nums ${b.netWorth < 0 ? "text-danger" : ""}`}>{formatINRCompact(b.netWorth)}</dd></div>
          <div className="border-s-2 border-accent ps-3"><dt className="text-xs text-fg-muted">{t("liquidNetWorth")}</dt><dd className={`mt-0.5 text-2xl font-semibold tabular-nums ${b.liquidNetWorth < 0 ? "text-danger" : ""}`}>{formatINRCompact(b.liquidNetWorth)}</dd></div>
        </dl>
        {b.assets > 0 ? (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full border border-border bg-bg" role="img" aria-label={t("liquidShare", { pct: pct(b.liquidAssets / b.assets) })}>
              <div className="h-full bg-accent" style={{ width: `${pct(b.liquidAssets / b.assets)}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-fg-muted">
              <span>{t("liquid")}: {formatINRCompact(b.liquidAssets)}</span>
              <span>{t("illiquid")}: {formatINRCompact(b.illiquidAssets)}</span>
            </div>
            <p className="mt-1 text-sm">{t("liquidShare", { pct: pct(b.liquidAssets / b.assets) })}</p>
          </div>
        ) : null}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">{t("liquidRule")}</summary>
          <p className="mt-2 text-fg-muted">{t("liquidRuleBody")}</p>
          <p className="mt-2 font-medium">{t("realEstateNote")}</p>
        </details>
      </Card>

      {b.concentration.length ? (
        <section aria-labelledby="concentration" className="space-y-2">
          <h2 id="concentration" className="text-sm font-semibold text-fg-muted">{t("concentration")}</h2>
          {b.concentration.map((c, i) => (
            <Notice key={i} tone="warning">
              {c.kind === "category" ? t("concentrationCategory", { category: categoryName(c.category), pct: pct(c.share) }) : t("concentrationItem", { label: c.item.label || td(`types.${c.item.family}.${c.item.type}` as "types.assets.cash"), pct: pct(c.share) })}
            </Notice>
          ))}
        </section>
      ) : b.assets > 0 ? <p className="text-sm text-fg-muted">{t("noConcentration")}</p> : null}

      {b.categories.length ? (
        <section aria-labelledby="allocation">
          <h2 id="allocation" className="mb-3 text-xl font-semibold">{t("allocation")}</h2>
          <div className="space-y-3">
            {b.categories.map((c) => (
              <Card key={c.category}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{categoryName(c.category)} <span className="text-fg-muted font-normal">· {t("share", { pct: pct(c.share) })}</span></h3>
                  <p className="tabular-nums font-semibold">{formatINRCompact(c.total)} <span className="text-xs font-normal text-fg-muted">({t("ofWhichLiquid", { amount: formatINRCompact(c.liquid) })})</span></p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-border bg-bg"><div className="h-full bg-accent" style={{ width: `${pct(c.share)}%` }} /></div>
                <ul className="mt-3 divide-y divide-border text-sm">
                  {c.items.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span>
                        {i.label || td(`types.${i.family}.${i.type}` as "types.assets.cash")}
                        <span className="text-xs text-fg-muted"> · {td(`types.${i.family}.${i.type}` as "types.assets.cash")}{i.valuationDate ? ` · ${t("valued", { date: i.valuationDate })}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <Pill tone={i.liquid ? "accent" : "neutral"}>{i.liquid ? t("liquid") : t("illiquid")}</Pill>
                        {formatINR(i.value)}
                        <Link href={`/app/data/${i.family}/${i.id}`} className="text-xs underline underline-offset-2">{t("editRecord")}</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="liabilities">
        <h2 id="liabilities" className="mb-3 text-xl font-semibold">{t("liabilitiesTitle")}</h2>
        {b.loans.length ? (
          <div className="overflow-x-auto rounded-card border border-border bg-bg-elevated">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>{t("loan")}</th><th className={th}>{t("outstanding")}</th><th className={th}>{t("rate")}</th><th className={th}>{t("emi")}</th><th className={th}>{t("left")}</th><th className={th}></th></tr></thead>
              <tbody>
                {b.loans.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link href={`/app/data/loans/${l.id}`} className="underline underline-offset-4">{l.label || td(`types.loans.${l.type}` as "types.loans.home")}</Link>
                      <span className="block text-xs text-fg-muted">{td(`types.loans.${l.type}` as "types.loans.home")}</span>
                    </td>
                    <td className={td2}>{formatINR(l.outstanding)}</td>
                    <td className={td2}>{l.interestPct !== undefined ? `${l.interestPct}%` : "—"}</td>
                    <td className={td2}>{l.emi ? formatINR(l.emi) : "—"}</td>
                    <td className={td2}>{l.monthsLeft ?? "—"}</td>
                    <td className="px-3 py-2 space-x-1">{l.highCost ? <Pill tone="danger">{t("highCost")}</Pill> : null}{l.shortTerm ? <Pill tone="warn">{t("shortTerm")}</Pill> : null}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold"><td className="px-3 py-2">{t("liabilities")}</td><td className={td2}>{formatINR(b.liabilities)}</td><td colSpan={4} className="px-3 py-2 text-xs font-normal text-fg-muted">{t("shortTerm")}: {formatINR(b.shortTermLiabilities)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-fg-muted">{t("noLoans")}</p>}
      </section>
    </div>
  );
}
