import "server-only";
import { getTranslations } from "next-intl/server";
import { localeMeta, routing } from "@/i18n/routing";
import { CALCULATORS } from "@/lib/calculators";
import { loadContent } from "@/lib/content/source";
import { moduleTitle, resolveTranslation } from "@/lib/content/store";

/** Options the article editor offers: languages, calculators and chapters to link. */
export async function editorOptions(locale: string) {
  const tc = await getTranslations("calc");
  const { snapshot } = await loadContent();
  const langs = (routing.locales as readonly string[]).map((code) => {
    const m = localeMeta(code);
    return { code, name: m.nativeName, dir: (m.dir ?? "ltr") as "ltr" | "rtl" };
  });
  const calculators = CALCULATORS.map((c) => ({ slug: c.slug, name: tc(`names.${c.slug}`) })).sort((a, b) => a.name.localeCompare(b.name));
  const chapters = snapshot.modules.flatMap((m) =>
    m.chapters.map((c) => ({
      value: `${m.track}/${m.slug}/${c.slug}`,
      label: `${moduleTitle(m, locale)?.title ?? m.slug} › ${resolveTranslation(c.translations, locale)?.translation.title ?? c.translations[0]?.title ?? c.slug}`,
    })),
  );
  return { langs, calculators, chapters };
}
