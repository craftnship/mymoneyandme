"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t("langSwitch")}</span>
      <select
        className="rounded-lg border border-border bg-bg-elevated px-1.5 sm:px-2 py-1.5 text-[0.8125rem] sm:text-sm"
        value={locale}
        onChange={(e) => {
          const next = e.target.value;
          // Keep the same route and params, swap only the locale segment.
          router.replace(
            // @ts-expect-error pathname and params are known to match
            { pathname, params },
            { locale: next },
          );
        }}
      >
        {LOCALES.filter((l) => (routing.locales as readonly string[]).includes(l.code)).map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
