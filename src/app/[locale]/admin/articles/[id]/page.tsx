import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { articleForEdit, listRevisions } from "@/lib/content/admin";
import { itemId } from "@/lib/content/rows";
import { restoredVersion } from "@/lib/content/revisions";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { RevisionList } from "@/components/admin/RevisionList";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ restore?: string }> }) {
  const { locale, id } = await params;
  const { restore } = await searchParams;
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const t = await getTranslations("admin.editor");
  const f = await getFormatter();
  if (!databaseConfigured()) return <Notice tone="warning">{t("errors.notConfigured")}</Notice>;
  const article = await articleForEdit(id).catch(() => undefined);
  if (!article) notFound();
  const [options, revisions, restored] = await Promise.all([editorOptions(locale), listRevisions(itemId.article({ id })), restoredVersion(restore, itemId.article({ id }), "article")]);
  const title = article.translations.find((tr) => tr.locale === article.sourceLocale)?.title || article.slug;
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline underline-offset-4">{t("back")}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-fg-muted">
        {revisions.length > 0
          ? t("lastSaved", { when: f.dateTime(revisions[0].savedAt, { dateStyle: "medium", timeStyle: "short" }), who: revisions[0].savedBy ?? "?", count: revisions.length })
          : t("neverSaved")}
      </p>
      <ArticleEditor
        key={restored ? `restore-${restore}` : revisions[0]?.id ?? 0}
        initial={restored?.doc ?? article}
        isNew={false}
        restored={restored ? t("restoredNotice", { when: f.dateTime(restored.savedAt, { dateStyle: "medium", timeStyle: "short" }) }) : undefined}
        {...options}
      />
      <RevisionList revisions={revisions} />
    </div>
  );
}
