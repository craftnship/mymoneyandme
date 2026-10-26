import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AccountLink } from "./AccountLink";

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center gap-x-3 sm:gap-x-4">
        <Link href="/" className="font-semibold text-[0.9375rem] sm:text-lg tracking-tight shrink-0">
          <span className="inline-block size-3 rounded-full bg-accent me-1.5 sm:me-2 align-middle" aria-hidden />
          {ts("name")}
        </Link>
        {/*
          One navigation landmark for every width: a full-width row under the brand on phones, inline on wider screens.
          On phones the brand already links home, so Home is dropped there; the rest spread across the row and a two-word
          label may wrap, so the long Tamil labels fit at 360px without a hidden scroll.
        */}
        <nav aria-label={t("menu")} className="order-last w-full md:order-none md:w-auto md:ms-4 flex items-center justify-around md:justify-start gap-1 pt-1 md:pt-0">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${l.href === "/" ? "hidden md:block " : ""}px-1.5 sm:px-3 py-2 rounded-lg text-sm leading-tight text-center font-medium text-fg-muted md:whitespace-nowrap hover:text-fg hover:bg-accent-soft`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {/* Reads the pathname and params, so it streams in on routes whose params cannot be enumerated at build time. */}
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <Suspense fallback={null}>
            <AccountLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
