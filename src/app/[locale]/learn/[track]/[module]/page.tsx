import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta } from "@/i18n/routing";
import { allModules, getModule, moduleFullyTranslated, moduleTitle, resolveTranslation } from "@/lib/content/store";
import type { Track } from "@/lib/content/types";
import { Notice, PageTitle, Pill } from "@/components/ui";

export function generateStaticParams() {
  return allModules().map((m) => ({ track: m.track, module: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; track: string; module: string }> }) {
  const { locale, track, module: slug } = await params;
  const m = getModule(track as Track, slug);
  if (!m) return {};
  const title = moduleTitle(m, locale);
  return { title: title.title, description: title.summary };
}

export default async function ModulePage({ params }: { params: Promise<{ locale: string; track: string; module: string }> }) {
  const { locale, track, module: slug } = await params;
  const m = getModule(track as Track, slug);
  if (!m) notFound();
  const t = await getTranslations("learn");
  const title = moduleTitle(m, locale);
  const full = moduleFullyTranslated(m, locale);
  const anyPublished = m.chapters.some((c) => c.translations.some((x) => x.state === "published"));

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-fg-muted mb-2">
        <Link href={`/learn/${m.track}`} className="underline underline-offset-4">{t(`track.${m.track}.title`)}</Link>
      </p>
      <PageTitle title={title.title} intro={title.summary} />
      <div className="flex flex-wrap gap-2 mb-6">
        <Pill tone="accent">{t(`difficulty.${m.difficulty}`)}</Pill>
        {m.level ? <Pill>{t("level", { level: m.level })}</Pill> : null}
        <Pill>{t("chapters", { count: m.chapters.length })}</Pill>
        <Pill>{t("hours", { count: m.estimatedHours })}</Pill>
      </div>
      {!anyPublished ? <Notice tone="info">{t("comingSoon")}</Notice> : null}
      {anyPublished && locale !== "en" && !full ? <Notice tone="warning">{t("partlyTranslated", { language: localeMeta(locale).nativeName })}</Notice> : null}
      <ol className="mt-6 divide-y divide-border rounded-card border border-border bg-bg-elevated">
        {m.chapters.map((c, i) => {
          const r = resolveTranslation(c.translations, locale);
          const draftTitle = c.translations.find((x) => x.locale === locale)?.title ?? c.translations[0]?.title;
          return (
            <li key={c.slug} className="p-4 flex items-start gap-4">
              <span className="font-mono text-sm text-fg-muted w-6 shrink-0 pt-0.5">{i + 1}</span>
              <div className="flex-1">
                {r ? (
                  <>
                    <Link href={`/learn/${m.track}/${m.slug}/${c.slug}`} className="font-medium hover:underline underline-offset-4">{r.translation.title}</Link>
                    <p className="text-sm text-fg-muted mt-0.5">{r.translation.excerpt}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-fg-muted">{draftTitle}</p>
                    <Pill tone="warn">{t("comingSoon")}</Pill>
                  </>
                )}
              </div>
              <span className="text-xs text-fg-muted shrink-0">{c.readingMinutes} min</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
