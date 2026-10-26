import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { emptyNews } from "@/lib/content/editing";
import { NewsEditor } from "@/components/admin/NewsEditor";
import { editorOptions } from "@/components/admin/editorData";
import { Notice } from "@/components/ui";

export default async function NewNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await adminAccess(locale);
  if (!access.ok) notFound();
  const t = await getTranslations("admin");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const { langs } = await editorOptions(locale);
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline underline-offset-4">{t("editor.back")}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{t("newsEditor.newTitle")}</h1>
      {!databaseConfigured() ? <Notice tone="warning">{t("editor.errors.notConfigured")}</Notice> : null}
      <NewsEditor initial={emptyNews("new", today, routing.defaultLocale)} isNew langs={langs} sourceLocale={routing.defaultLocale} />
    </div>
  );
}
