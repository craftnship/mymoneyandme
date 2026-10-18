import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCalculator, resolveDefaults } from "@/lib/calculators";
import { CURRENT_RULEPACK_VERSION } from "@/lib/rulepack";
import { Calculator } from "./Calculator";

/** Server wrapper: resolves rule-pack defaults, then hands a client calculator its definition. */
export async function CalculatorEmbed({ slug, initial, full = false }: { slug: string; initial?: Record<string, number>; full?: boolean }) {
  const def = getCalculator(slug);
  if (!def) return null;
  const t = await getTranslations("calc");
  const defaults = resolveDefaults(def);
  return (
    <section className="rounded-card border border-border bg-bg-elevated p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        {full ? (
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{t(`names.${slug}`)}</h1>
        ) : (
          <h3 className="text-xl font-semibold">
            <Link href={`/calculators/${slug}`} className="hover:underline underline-offset-4">{t(`names.${slug}`)}</Link>
          </h3>
        )}
        <p className="text-xs text-fg-muted">{t("assumptionsNote", { version: CURRENT_RULEPACK_VERSION })}</p>
      </div>
      <Calculator def={def} defaults={defaults} initial={{ ...defaults, ...initial }} compact={!full} />
    </section>
  );
}
