import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getRulePack } from "@/lib/rulepack";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const ts = await getTranslations("site");
  const pack = getRulePack();
  const legal = [
    { slug: "disclaimer", label: t("disclaimer") },
    { slug: "privacy", label: t("privacy") },
    { slug: "terms", label: t("terms") },
    { slug: "grievance", label: t("grievance") },
    { slug: "accessibility", label: t("accessibility") },
  ];

  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3 text-sm text-fg-muted">
        <div>
          <p className="font-semibold text-fg">{ts("name")}</p>
          <p className="mt-2">{t("educational")}</p>
          <p className="mt-2">{t("free")}</p>
        </div>
        <div>
          <p className="font-semibold text-fg">{t("legal")}</p>
          <ul className="mt-2 space-y-1">
            {legal.map((l) => (
              <li key={l.slug}>
                <Link href={`/legal/${l.slug}`} className="hover:text-fg underline-offset-2 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p>
            <a href={`mailto:${t("contact")}`} className="hover:text-fg">{t("contact")}</a>
          </p>
          <p className="mt-2 text-xs">{t("rulePack", { version: pack.version, date: pack.effectiveFrom })}</p>
        </div>
      </div>
    </footer>
  );
}
