import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { getRevision } from "@/lib/content/admin";
import { diffDocs, type Change } from "@/lib/content/diff";
import { currentOf, editorPath, parseItemKey } from "@/lib/content/revisions";
import { Notice } from "@/components/ui";

/** What changed between a saved version and the item as it is now, with a way to load that version back. */
export default async function RevisionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const access = await adminAccess(locale);
  if (!access.ok || !/^\d{1,12}$/.test(id)) notFound();
  const t = await getTranslations("admin.history");
  const te = await getTranslations("admin.editor");
  const f = await getFormatter();
  if (!databaseConfigured()) return <Notice tone="warning">{te("errors.notConfigured")}</Notice>;
  const rev = await getRevision(Number(id)).catch(() => undefined);
  const ref = rev && parseItemKey(rev.itemKey);
  if (!rev || !ref) notFound();
  const current = await currentOf(ref).catch(() => undefined);
  const changes = current ? diffDocs(rev.snapshot as object, current) : [];
  const editor = editorPath(ref);
  const when = f.dateTime(rev.savedAt, { dateStyle: "medium", timeStyle: "short" });

  const label = (c: Change) => {
    const w = c.where;
    if (w.kind === "setting") return t("setting", { field: w.field });
    const language = localeMeta(w.locale).nativeName;
    if (w.kind === "text") return t("field", { language, field: w.field });
    return t("block", { language, n: w.index + 1, type: te(`blockTypes.${w.type}`) });
  };

  return (
    <div className="space-y-5">
      <Link href={editor} className="text-sm underline underline-offset-4">{t("back")}</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{t("title", { when })}</h1>
      <p className="text-sm text-fg-muted">{t("intro", { who: rev.savedBy ?? "?" })}</p>
      {!current ? <Notice tone="warning">{t("gone")}</Notice> : null}
      {current && ref.kind !== "module" ? (
        <Link href={`${editor}?restore=${rev.id}`} className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium hover:bg-accent-strong">{t("restore")}</Link>
      ) : null}
      {current && ref.kind !== "module" ? <p className="text-sm text-fg-muted">{t("restoreHint")}</p> : null}
      {current && changes.length === 0 ? <Notice tone="info">{t("same")}</Notice> : null}
      {changes.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-fg-muted">{t("what")}</th>
                <th className="px-3 py-2 text-start font-medium text-fg-muted">{t("then")}</th>
                <th className="px-3 py-2 text-start font-medium text-fg-muted">{t("now")}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.key} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{label(c)}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap text-fg-muted" lang={"locale" in c.where ? c.where.locale : undefined}>{c.before ?? <em>{t("absent")}</em>}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap" lang={"locale" in c.where ? c.where.locale : undefined}>{c.after ?? <em>{t("absent")}</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
