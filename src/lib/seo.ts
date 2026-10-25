import { routing } from "@/i18n/routing";

/**
 * Canonical and hreflang entries for a page. Every URL carries its locale, so
 * the canonical is the page's own localised path and `languages` lists the
 * same path in each locale the page exists in (plus x-default on English).
 */
export function pageAlternates(locale: string, path: string, locales: readonly string[] = routing.locales) {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])) as Record<string, string>;
  if (locales.includes(routing.defaultLocale)) languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

/** Serialises structured data for a <script type="application/ld+json">, escaping "<" so it cannot close the tag. */
export function jsonLd(data: Record<string, unknown>) {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}
