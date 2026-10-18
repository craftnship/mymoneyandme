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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/" className="font-semibold text-lg tracking-tight shrink-0">
          <span className="inline-block size-3 rounded-full bg-accent me-2 align-middle" aria-hidden />
          {ts("name")}
        </Link>
        <nav aria-label={t("menu")} className="hidden md:flex items-center gap-1 ms-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-2 rounded-lg text-sm font-medium text-fg-muted hover:text-fg hover:bg-accent-soft">
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
      <nav aria-label={t("menu")} className="md:hidden flex overflow-x-auto gap-1 px-2 pb-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-lg text-sm font-medium text-fg-muted whitespace-nowrap hover:bg-accent-soft">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
