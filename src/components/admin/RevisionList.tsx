import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Revision } from "@/lib/content/admin";

/** The latest saved versions of an item, each linking to what changed since and a restore. */
export async function RevisionList({ revisions }: { revisions: Revision[] }) {
  if (revisions.length === 0) return null;
  const t = await getTranslations("admin.history");
  const f = await getFormatter();
  return (
    <details className="rounded-card border border-border p-4 text-sm">
      <summary className="cursor-pointer font-medium">{t("heading", { count: revisions.length })}</summary>
      <ol className="mt-3 space-y-1">
        {revisions.map((r, i) => (
          <li key={r.id} className="flex flex-wrap gap-2">
            <span>{f.dateTime(r.savedAt, { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="text-fg-muted">{r.savedBy ?? "?"}</span>
            {i === 0 ? <span className="text-fg-muted">· {t("current")}</span> : <Link href={`/admin/history/${r.id}`} className="underline underline-offset-4">{t("compare")}</Link>}
          </li>
        ))}
      </ol>
    </details>
  );
}
