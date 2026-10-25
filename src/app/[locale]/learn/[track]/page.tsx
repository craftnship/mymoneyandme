import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta } from "@/i18n/routing";
import { moduleFullyTranslated, moduleTitle, modulesForTrack, publishedChapters } from "@/lib/content/store";
import type { Module, Track } from "@/lib/content/types";
import { Card, PageTitle, Pill } from "@/components/ui";
import { pageAlternates } from "@/lib/seo";

const TRACKS: Track[] = ["adults", "kids", "women"];

export function generateStaticParams() {
  return TRACKS.map((track) => ({ track }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; track: string }> }) {
  const { locale, track } = await params;
  if (!TRACKS.includes(track as Track)) return {};
  const t = await getTranslations("learn");
  return { title: `${t(`track.${track as Track}.title`)} · ${t("title")}`, description: t(`track.${track as Track}.body`), alternates: pageAlternates(locale, `/learn/${track}`) };
}

export default async function TrackPage({ params }: { params: Promise<{ locale: string; track: string }> }) {
  const { locale, track } = await params;
  if (!TRACKS.includes(track as Track)) notFound();
  const tr = track as Track;
  const t = await getTranslations("learn");
  const mods = await modulesForTrack(tr);
  // Modules with nothing published yet sit in a collapsed list at the end, so the track reads as what can be read today.
  const ready = mods.filter((m) => publishedChapters(m).length > 0);
  const planned = mods.filter((m) => publishedChapters(m).length === 0);

  return (
    <div>
      <nav className="flex gap-2 mb-6" aria-label={t("title")}>
        {TRACKS.map((x) => (
          <Link key={x} href={`/learn/${x}`} className={`rounded-full px-4 py-1.5 text-sm font-medium border ${x === tr ? "bg-accent text-white border-accent" : "border-border hover:bg-accent-soft"}`} aria-current={x === tr ? "page" : undefined}>
            {t(`track.${x}.title`)}
          </Link>
        ))}
      </nav>
      <PageTitle title={t(`track.${tr}.title`)} intro={t(`track.${tr}.body`)} />
      <ModuleList modules={ready} track={tr} locale={locale} />
      {planned.length ? (
        <details className="mt-8 rounded-card border border-border p-5">
          <summary className="cursor-pointer text-lg font-semibold">{t("plannedModules", { count: planned.length })}</summary>
          <p className="mt-2 text-sm text-fg-muted">{t("plannedIntro")}</p>
          <div className="mt-4">
            <ModuleList modules={planned} track={tr} locale={locale} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

async function ModuleList({ modules, track, locale }: { modules: Module[]; track: Track; locale: string }) {
  const t = await getTranslations("learn");
  return (
    <ol className="grid gap-4 md:grid-cols-2">
      {modules.map((m) => {
        const title = moduleTitle(m, locale);
        const published = publishedChapters(m).length;
        const full = moduleFullyTranslated(m, locale);
        // Hours scale with what is readable; a module with half its chapters published is half the reading.
        const hours = published === m.chapters.length ? m.estimatedHours : Math.max(1, Math.round((m.estimatedHours * published) / Math.max(1, m.chapters.length)));
        return (
          <li key={m.slug}>
            <Link href={`/learn/${track}/${m.slug}`} className="block h-full">
              <Card className="h-full hover:border-accent transition-colors">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-fg-muted">{String(m.order).padStart(2, "0")}</span>
                  <Pill tone="accent">{t(`difficulty.${m.difficulty}`)}</Pill>
                  {m.level ? <Pill>{t("level", { level: m.level })}</Pill> : null}
                  {published === 0 ? <Pill tone="warn">{t("comingSoon")}</Pill> : null}
                  {published > 0 && locale !== "en" && full ? <Pill tone="accent">{t("fullyTranslated", { language: localeMeta(locale).nativeName })}</Pill> : null}
                </div>
                <h2 className="mt-2 text-xl font-semibold">{title.title}</h2>
                <p className="mt-1 text-fg-muted">{title.summary}</p>
                <p className="mt-3 text-sm text-fg-muted">
                  {t("moduleChaptersReady", { ready: published, total: m.chapters.length })}
                  {published > 0 ? <> · {t("hours", { count: hours })}</> : null}
                </p>
              </Card>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
