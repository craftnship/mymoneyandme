import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { chapterForEdit, listRevisions } from "@/lib/content/admin";
import { itemId } from "@/lib/content/rows";
import { moduleTitle } from "@/lib/content/store";
import { isTrack } from "@/lib/content/json";
import { restoredVersion } from "@/lib/content/revisions";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { RevisionList } from "@/components/admin/RevisionList";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function EditChapterPage({ params, searchParams }: { params: Promise<{ locale: string; track: string; module: string; chapter: string }>; searchParams: Promise<{ restore?: string }> }) {
  const { locale, track, module: moduleSlug, chapter: chapterSlug } = await params;
  const { restore } = await searchParams;
  const access = await adminAccess(locale);
  if (!access.ok || !isTrack(track)) notFound();
  const t = await getTranslations("admin.editor");
  const f = await getFormatter();
  if (!databaseConfigured()) return <Notice tone="warning">{t("errors.notConfigured")}</Notice>;
  const hit = await chapterForEdit(track, moduleSlug, chapterSlug).catch(() => undefined);
  if (!hit) notFound();
  const key = itemId.chapter(hit.module, hit.chapter);
  const [options, revisions, restored] = await Promise.all([editorOptions(locale), listRevisions(key), restoredVersion(restore, key, "chapter")]);
  const title = hit.chapter.translations.find((tr) => tr.locale === routing.defaultLocale)?.title || hit.chapter.slug;
  return (
    <div className="space-y-4">
      <Link href={`/admin/learn/${track}/${moduleSlug}`} className="text-sm underline underline-offset-4">← {moduleTitle(hit.module, locale)?.title ?? moduleSlug}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-fg-muted">
        {revisions.length > 0
          ? t("lastSaved", { when: f.dateTime(revisions[0].savedAt, { dateStyle: "medium", timeStyle: "short" }), who: revisions[0].savedBy ?? "?", count: revisions.length })
          : t("neverSaved")}
      </p>
      <ChapterEditor
        key={restored ? `restore-${restore}` : revisions[0]?.id ?? 0}
        initial={restored?.doc ?? hit.chapter}
        restored={restored ? t("restoredNotice", { when: f.dateTime(restored.savedAt, { dateStyle: "medium", timeStyle: "short" }) }) : undefined}
        isNew={false} track={track} moduleSlug={moduleSlug} sourceLocale={routing.defaultLocale} langs={options.langs} calculators={options.calculators} />
      <RevisionList revisions={revisions} />
    </div>
  );
}
