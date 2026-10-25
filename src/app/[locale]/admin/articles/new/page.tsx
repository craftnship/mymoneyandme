import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { adminAccess } from "@/lib/auth/admin";
import { emptyArticle } from "@/lib/content/editing";
import { loadContent } from "@/lib/content/source";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function NewArticlePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const t = await getTranslations("admin.editor");
  const { from } = await loadContent();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const options = await editorOptions(locale);
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline underline-offset-4">{t("back")}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{t("newTitle")}</h1>
      {from !== "database" ? <Notice tone="warning">{t("errors.notConfigured")}</Notice> : null}
      <ArticleEditor initial={emptyArticle("new", today)} isNew {...options} />
    </div>
  );
}
