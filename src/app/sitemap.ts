import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { allArticles, allModules, availableLocales } from "@/lib/content/store";
import { CALCULATORS } from "@/lib/calculators";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, locales: readonly string[] = routing.locales, priority = 0.6) => {
    for (const l of locales) {
      entries.push({
        url: `${BASE}/${l}${path}`,
        priority,
        alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${BASE}/${x}${path}`])) },
      });
    }
  };
  push("", routing.locales, 1);
  push("/learn", routing.locales, 0.9);
  push("/calculators", routing.locales, 0.9);
  push("/check-up", routing.locales, 0.8);
  push("/articles", routing.locales, 0.8);
  push("/about", routing.locales, 0.5);
  for (const page of ["disclaimer", "privacy", "terms", "grievance", "accessibility"]) push(`/legal/${page}`, routing.locales, 0.3);
  for (const a of allArticles()) push(`/articles/${a.slug}`, availableLocales(a.translations).filter((l) => (routing.locales as readonly string[]).includes(l)), 0.8);
  for (const c of CALCULATORS) push(`/calculators/${c.slug}`, routing.locales, 0.7);
  for (const t of ["adults", "kids", "women"]) push(`/learn/${t}`, routing.locales, 0.8);
  for (const m of allModules()) {
    // Modules without a single published chapter are noindex "coming soon" shells and stay out of the sitemap.
    if (!m.chapters.some((c) => c.translations.some((t) => t.state === "published"))) continue;
    push(`/learn/${m.track}/${m.slug}`, routing.locales, 0.7);
    for (const c of m.chapters) {
      const locales = availableLocales(c.translations).filter((l) => (routing.locales as readonly string[]).includes(l));
      if (locales.length) push(`/learn/${m.track}/${m.slug}/${c.slug}`, locales, 0.7);
    }
  }
  return entries;
}
