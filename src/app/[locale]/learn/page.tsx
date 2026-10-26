import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { firstPublishedChapter, modulesForTrack, moduleTitle, publishedChapters, resolveTranslation } from "@/lib/content/store";
import { Card, PageTitle } from "@/components/ui";
import { ContinueReading } from "@/components/ChapterReading";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("learn");
  return { title: t("title"), description: t("intro"), alternates: pageAlternates(locale, "/learn") };
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("learn");
  const tracks = ["adults", "kids", "women"] as const;
  const data = await Promise.all(tracks.map(async (track) => ({ track, mods: await modulesForTrack(track), first: await firstPublishedChapter(track) })));
  return (
    <div>
      <PageTitle title={t("title")} intro={t("intro")} />
      <ContinueReading />
      <div className="grid gap-4 md:grid-cols-3">
        {data.map(({ track, mods, first }) => {
          const total = mods.reduce((s, m) => s + m.chapters.length, 0);
          const ready = mods.reduce((s, m) => s + publishedChapters(m).length, 0);
          const firstTitle = first ? resolveTranslation(first.chapter.translations, locale)?.translation.title : undefined;
          return (
            <Card key={track} className="flex h-full flex-col hover:border-accent transition-colors">
              <h2 className="text-2xl font-semibold"><Link href={`/learn/${track}`} className="after:absolute after:inset-0 relative">{t(`track.${track}.title`)}</Link></h2>
              <p className="mt-2 text-fg-muted">{t(`track.${track}.body`)}</p>
              <p className="mt-4 text-sm text-fg-muted">{t("modules", { count: mods.length })} · {t("chaptersReady", { ready, total })}</p>
              {first && firstTitle ? (
                <p className="mt-3 text-sm">
                  <Link href={`/learn/${track}/${first.module.slug}/${first.chapter.slug}`} className="relative z-10 font-medium underline underline-offset-4 hover:text-accent">{t("startHere", { title: firstTitle })}</Link>
                </p>
              ) : null}
              {/* Modules with something to read, so the hub shows the curriculum rather than three bare cards. */}
              {mods.some((m) => publishedChapters(m).length) ? (
                <div className="relative z-10 mt-5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("modulesReady")}</p>
                  <ul className="mt-2 space-y-1.5">
                    {mods.filter((m) => publishedChapters(m).length).map((m) => (
                      <li key={m.slug} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/learn/${track}/${m.slug}`} className="hover:underline underline-offset-4">{moduleTitle(m, locale).title}</Link>
                        <span className="shrink-0 text-xs text-fg-muted tabular-nums">{publishedChapters(m).length}/{m.chapters.length}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
