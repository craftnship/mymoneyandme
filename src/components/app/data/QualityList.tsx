import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui";
import type { QualityIssue } from "@/lib/data/quality";
import { qualityHref } from "@/lib/data/quality";
import { formatINR } from "@/lib/format";

/** The data-quality issues of section 8, each linking to the item to fix. */
export async function QualityList({ issues }: { issues: QualityIssue[] }) {
  const t = await getTranslations("appData");
  if (!issues.length) return null;
  const text = (i: QualityIssue) => {
    const family = t(`families.${i.family}.one`);
    const name = i.label || family;
    switch (i.kind) {
      case "stale": return t("quality.stale", { name, months: i.months });
      case "duplicate": return t("quality.duplicate", { name, count: i.ids.length, amount: formatINR(i.amount) });
      case "zero": return t("quality.zero", { name });
      case "loanNoEmi": return t("quality.loanNoEmi", { name });
      case "ended": return t("quality.ended", { name, date: i.endDate });
    }
  };
  return (
    <Card id="quality">
      <h2 className="font-semibold">{t("quality.title", { count: issues.length })}</h2>
      <p className="mt-1 text-sm text-fg-muted">{t("quality.intro")}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {issues.map((i, k) => (
          <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border/60 pt-2">
            <span>{text(i)}</span>
            <Link href={qualityHref(i)} className="underline underline-offset-4">{i.kind === "duplicate" ? t("quality.review") : t("quality.fix")}</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
