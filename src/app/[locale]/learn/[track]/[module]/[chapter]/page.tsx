import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta, routing } from "@/i18n/routing";
import { allModules, availableLocales, getChapter, modulesForTrack, moduleTitle, resolveTranslation } from "@/lib/content/store";
import type { Chapter, Track } from "@/lib/content/types";
import { BlockRenderer, blockSections } from "@/components/BlockRenderer";
import { ChapterTracker, ReadingProgress, ReadTick } from "@/components/ChapterReading";
import { Notice, Pill } from "@/components/ui";
import { jsonLd, pageAlternates } from "@/lib/seo";

export async function generateStaticParams() {
  return (await allModules()).flatMap((m) =>
    m.chapters.filter((c) => c.translations.some((t) => t.state === "published")).map((c) => ({ track: m.track, module: m.slug, chapter: c.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }> }) {
  const { locale, track, module: mod, chapter } = await params;
  const hit = await getChapter(track as Track, mod, chapter);
  if (!hit) return {};
  const r = resolveTranslation(hit.chapter.translations, locale);
  if (!r) return {};
  const locales = availableLocales(hit.chapter.translations).filter((l) => (routing.locales as readonly string[]).includes(l));
  return { title: r.translation.title, description: r.translation.excerpt, alternates: pageAlternates(locale, `/learn/${track}/${mod}/${chapter}`, locales), openGraph: { type: "article" } };
}

export default async function ChapterPage({ params }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }> }) {
  const { locale, track, module: mod, chapter } = await params;
  const hit = await getChapter(track as Track, mod, chapter);
  if (!hit) notFound();
  const r = resolveTranslation(hit.chapter.translations, locale);
  if (!r) notFound();
  const t = await getTranslations("learn");
  const ta = await getTranslations("article");
  const f = await getFormatter();
  const { module, index } = hit;
  const title = moduleTitle(module, locale);
  const readable = (c: Chapter) => resolveTranslation(c.translations, locale);
  const prevIndex = module.chapters.slice(0, index).findLastIndex((c) => readable(c));
  const nextOffset = module.chapters.slice(index + 1).findIndex((c) => readable(c));
  const prev = prevIndex >= 0 ? { chapter: module.chapters[prevIndex], number: prevIndex + 1 } : undefined;
  const next = nextOffset >= 0 ? { chapter: module.chapters[index + 1 + nextOffset], number: index + 2 + nextOffset } : undefined;
  // At the end of a module, point on to the first readable chapter of the next module in the track.
  const trackModules = await modulesForTrack(module.track);
  const nextModule = next
    ? undefined
    : trackModules.slice(trackModules.findIndex((m) => m.slug === module.slug) + 1).map((m) => ({ m, c: m.chapters.find((c) => readable(c)) })).find((x) => x.c);
  const sections = blockSections(r.translation.blocks);
  const path = `${module.track}/${module.slug}/${hit.chapter.slug}`;
  const updated = r.translation.updatedAt ?? r.translation.publishedAt;

  const structured = jsonLd({
    "@type": "Article",
    headline: r.translation.title,
    description: r.translation.excerpt,
    inLanguage: r.locale,
    isPartOf: { "@type": "Course", name: title.title, provider: { "@type": "Organization", name: "My Money & Me" } },
    author: { "@type": "Organization", name: "My Money & Me" },
    ...(r.translation.publishedAt ? { datePublished: r.translation.publishedAt } : {}),
    ...(r.translation.updatedAt ? { dateModified: r.translation.updatedAt } : {}),
  });

  const chapterList = (
    <ol className="space-y-1">
      {module.chapters.map((c, i) => {
        const cr = readable(c);
        const current = i === index;
        const cPath = `${module.track}/${module.slug}/${c.slug}`;
        return (
          <li key={c.slug}>
            {cr ? (
              <Link
                href={`/learn/${cPath}`}
                aria-current={current ? "page" : undefined}
                className={`flex gap-2 rounded-lg px-2 py-1.5 text-sm ${current ? "bg-accent-soft font-semibold text-fg" : "text-fg-muted hover:bg-accent-soft hover:text-fg"}`}
              >
                <span className="w-4 shrink-0 tabular-nums">{i + 1}</span>
                <span className="flex-1">{cr.translation.title}</span>
                <ReadTick path={cPath} />
              </Link>
            ) : (
              <span className="flex gap-2 px-2 py-1.5 text-sm text-fg-muted/70">
                <span className="w-4 shrink-0 tabular-nums">{i + 1}</span>
                <span className="flex-1">{c.translations.find((x) => x.locale === locale)?.title ?? c.translations[0]?.title} · {t("comingSoon")}</span>
              </span>
            )}
            {current && sections.length >= 3 ? (
              <ul className="ms-8 mt-1 mb-2 space-y-1 border-s border-border ps-3" aria-label={t("onThisPage")}>
                {sections.map((s) => (
                  <li key={s.id}><a href={`#${s.id}`} className="block text-sm text-fg-muted hover:text-fg">{s.text}</a></li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );

  const card = (href: string, label: string, heading: string, minutes: number | undefined, align: "start" | "end") => (
    <Link href={href} className={`group flex flex-col gap-1 rounded-card border border-border bg-bg-elevated p-4 hover:border-accent ${align === "end" ? "sm:text-end sm:col-start-2" : ""}`}>
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="font-semibold group-hover:underline underline-offset-4">{heading}</span>
      {minutes ? <span className="text-sm text-fg-muted">{t("minutes", { count: minutes })}</span> : null}
    </Link>
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,42rem)] lg:justify-center lg:gap-12">
      <ReadingProgress />
      <aside className="hidden lg:block no-print">
        <nav aria-label={t("inThisModule")} className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">
          <Link href={`/learn/${module.track}/${module.slug}`} className="block px-2 text-sm font-semibold hover:underline underline-offset-4">{title.title}</Link>
          <p className="px-2 mt-0.5 mb-3 text-xs text-fg-muted">{t("chapterOf", { index: index + 1, total: module.chapters.length })}</p>
          {chapterList}
        </nav>
      </aside>
      <article className="reading-column min-w-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
        <p className="text-sm text-fg-muted">
          <Link href={`/learn/${module.track}`} className="underline underline-offset-4">{t(`track.${module.track}.title`)}</Link>
          {" / "}
          <Link href={`/learn/${module.track}/${module.slug}`} className="underline underline-offset-4">{title.title}</Link>
        </p>
        <p className="mt-4 text-sm font-medium text-accent-strong">{t("chapterOf", { index: index + 1, total: module.chapters.length })}</p>
        <h1 className="reading-title mt-1 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{r.translation.title}</h1>
        <p className="mt-3 text-lg text-fg-muted">{r.translation.excerpt}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <span>My Money &amp; Me</span>
          {updated ? <><span aria-hidden>·</span><span>{ta("updatedOn", { date: f.dateTime(new Date(updated), { dateStyle: "medium" }) })}</span></> : null}
          <span aria-hidden>·</span>
          <span>{t("minutes", { count: hit.chapter.readingMinutes })}</span>
        </p>
        {r.translation.aiDraft ? <p className="mt-2"><Pill tone="warn">{ta("aiTag")}</Pill></p> : null}
        {r.fallback ? <div className="mt-4"><Notice tone="warning">{ta("notTranslated", { language: localeMeta(locale).nativeName, shown: localeMeta(r.locale).nativeName })}</Notice></div> : null}
        <details className="lg:hidden mt-5 rounded-card border border-border bg-bg-elevated no-print">
          <summary className="cursor-pointer px-4 py-3 font-medium">{sections.length >= 3 ? `${t("onThisPage")} · ${t("inThisModule")}` : t("inThisModule")}</summary>
          <div className="px-2 pb-3">{chapterList}</div>
        </details>
        <div className="mt-8">
          <BlockRenderer blocks={r.translation.blocks} kids={module.track === "kids"} />
        </div>
        <ChapterTracker path={path} title={r.translation.title} />
        <nav aria-label={`${t("previousChapter")} / ${t("nextChapter")}`} className="mt-12 grid gap-3 sm:grid-cols-2 no-print">
          {prev ? card(`/learn/${module.track}/${module.slug}/${prev.chapter.slug}`, `← ${t("previousChapter")} · ${t("chapterN", { index: prev.number })}`, readable(prev.chapter)!.translation.title, prev.chapter.readingMinutes, "start") : null}
          {next
            ? card(`/learn/${module.track}/${module.slug}/${next.chapter.slug}`, `${t("nextChapter")} · ${t("chapterN", { index: next.number })} →`, readable(next.chapter)!.translation.title, next.chapter.readingMinutes, "end")
            : nextModule
              ? card(`/learn/${module.track}/${nextModule.m.slug}/${nextModule.c!.slug}`, `${t("nextModule")}: ${moduleTitle(nextModule.m, locale).title} →`, readable(nextModule.c!)!.translation.title, nextModule.c!.readingMinutes, "end")
              : card(`/learn/${module.track}/${module.slug}`, t("backToModule"), title.title, undefined, "end")}
        </nav>
      </article>
    </div>
  );
}
