import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { listRevisions, moduleForEdit } from "@/lib/content/admin";
import { itemId } from "@/lib/content/rows";
import { RevisionList } from "@/components/admin/RevisionList";
import { isTrack } from "@/lib/content/json";
import { moduleTitle } from "@/lib/content/store";
import { ModuleEditor } from "@/components/admin/ModuleEditor";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function EditModulePage({ params }: { params: Promise<{ locale: string; track: string; module: string }> }) {
  const { locale, track, module: slug } = await params;
  const access = await adminAccess(locale);
  if (!access.ok || !isTrack(track)) notFound();
  const t = await getTranslations("admin");
  const tl = await getTranslations("learn");
  if (!databaseConfigured()) return <Notice tone="warning">{t("editor.errors.notConfigured")}</Notice>;
  const mod = await moduleForEdit(track, slug).catch(() => undefined);
  if (!mod) notFound();
  const [{ langs }, revisions] = await Promise.all([editorOptions(locale), listRevisions(itemId.module(mod))]);
  const chapters = mod.chapters.map((c) => ({
    slug: c.slug,
    title: (c.translations.find((tr) => tr.locale === locale) ?? c.translations.find((tr) => tr.locale === routing.defaultLocale) ?? c.translations[0])?.title ?? c.slug,
    minutes: c.readingMinutes,
    states: Object.fromEntries(c.translations.map((tr) => [tr.locale, tr.state])),
  }));
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline underline-offset-4">{t("editor.back")}</Link>
      <p className="text-sm text-fg-muted">{tl(`track.${track}.title`)}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{moduleTitle(mod, locale)?.title ?? slug}</h1>
      <Link href={`/learn/${track}/${slug}`} className="inline-block text-sm underline underline-offset-4">{t("articles.view")}</Link>
      <ModuleEditor key={JSON.stringify([mod.translations, chapters.map((c) => c.slug), mod.difficulty, mod.estimatedHours])} module={mod} chapters={chapters} langs={langs} sourceLocale={routing.defaultLocale} />
      <RevisionList revisions={revisions} />
    </div>
  );
}
