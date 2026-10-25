import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { moduleForEdit } from "@/lib/content/admin";
import { emptyChapter } from "@/lib/content/editing";
import { moduleTitle } from "@/lib/content/store";
import { isTrack } from "@/lib/content/json";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function NewChapterPage({ params }: { params: Promise<{ locale: string; track: string; module: string }> }) {
  const { locale, track, module: moduleSlug } = await params;
  const access = await adminAccess(locale);
  if (!access.ok || !isTrack(track)) notFound();
  const t = await getTranslations("admin.chapter");
  if (!databaseConfigured()) return <Notice tone="warning">{(await getTranslations("admin.editor"))("errors.notConfigured")}</Notice>;
  const mod = await moduleForEdit(track, moduleSlug).catch(() => undefined);
  if (!mod) notFound();
  const options = await editorOptions(locale);
  return (
    <div className="space-y-4">
      <Link href={`/admin/learn/${track}/${moduleSlug}`} className="text-sm underline underline-offset-4">← {moduleTitle(mod, locale)?.title ?? moduleSlug}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{t("newTitle")}</h1>
      <ChapterEditor initial={emptyChapter("", "", routing.defaultLocale)} isNew track={track} moduleSlug={moduleSlug} sourceLocale={routing.defaultLocale} langs={options.langs} calculators={options.calculators} />
    </div>
  );
}
