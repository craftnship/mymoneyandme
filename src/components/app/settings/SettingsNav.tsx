"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Settings sub-navigation; the current section is marked for assistive tech and styled. */
export function SettingsNav() {
  const t = useTranslations("appSettings.nav");
  const pathname = usePathname();
  const links = [
    { href: "/app/settings", label: t("profile"), active: pathname === "/app/settings" || pathname.startsWith("/app/settings/risk") },
    { href: "/app/settings/security", label: t("security"), active: pathname.startsWith("/app/settings/security") },
    { href: "/app/settings/privacy", label: t("privacy"), active: pathname.startsWith("/app/settings/privacy") },
  ] as const;
  return (
    <nav aria-label={t("label")} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${l.active ? "border-accent text-accent-strong" : "border-transparent text-fg-muted hover:text-fg"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
