import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const ts = await getTranslations("site");
  const links = [
    { href: "/", label: t("home") },
    { href: "/learn", label: t("learn") },
    { href: "/calculators", label: t("calculators") },
    { href: "/check-up", label: t("checkup") },
  ] as const;

  return (
    <header className="border-b border-border bg-bg-elevated/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center gap-x-4">
        <Link href="/" className="font-semibold text-lg tracking-tight shrink-0">
          <span className="inline-block size-3 rounded-full bg-accent me-2 align-middle" aria-hidden />
          {ts("name")}
        </Link>
        {/* One navigation landmark for every width: a scrolling row under the brand on phones, inline on wider screens. */}
        <nav aria-label={t("menu")} className="order-last w-full md:order-none md:w-auto md:ms-4 flex items-center gap-1 overflow-x-auto pt-1 md:pt-0">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-2 rounded-lg text-sm font-medium text-fg-muted whitespace-nowrap hover:text-fg hover:bg-accent-soft">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <span className="hidden sm:inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted" title={t("comingSoon")}>
            {t("signIn")}
          </span>
        </div>
      </div>
    </header>
  );
}
