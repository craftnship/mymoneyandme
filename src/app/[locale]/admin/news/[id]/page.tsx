import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { listRevisions, newsForEdit } from "@/lib/content/admin";
import { itemId } from "@/lib/content/rows";
import { newsText } from "@/lib/content/store";
import { NewsEditor } from "@/components/admin/NewsEditor";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function EditNewsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const t = await getTranslations("admin.editor");
  const f = await getFormatter();
  if (!databaseConfigured()) return <Notice tone="warning">{t("errors.notConfigured")}</Notice>;
  const item = await newsForEdit(id).catch(() => undefined);
  if (!item) notFound();
  const [{ langs }, revisions] = await Promise.all([editorOptions(locale), listRevisions(itemId.news(item))]);
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline underline-offset-4">{t("back")}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{newsText(item, locale)?.title}</h1>
      <p className="text-sm text-fg-muted">
        {revisions.length > 0
          ? t("lastSaved", { when: f.dateTime(revisions[0].savedAt, { dateStyle: "medium", timeStyle: "short" }), who: revisions[0].savedBy ?? "?", count: revisions.length })
          : t("neverSaved")}
      </p>
      <NewsEditor key={revisions[0]?.id ?? 0} initial={item} isNew={false} langs={langs} sourceLocale={routing.defaultLocale} />
    </div>
  );
}
