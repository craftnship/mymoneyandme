import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { firstPublishedChapter, modulesForTrack, publishedChapters, resolveTranslation } from "@/lib/content/store";
import { Card, PageTitle } from "@/components/ui";
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
  return (
    <div>
      <PageTitle title={t("title")} intro={t("intro")} />
      <div className="grid gap-4 md:grid-cols-3">
        {tracks.map((track) => {
          const mods = modulesForTrack(track);
          const total = mods.reduce((s, m) => s + m.chapters.length, 0);
          const ready = mods.reduce((s, m) => s + publishedChapters(m).length, 0);
          const first = firstPublishedChapter(track);
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
