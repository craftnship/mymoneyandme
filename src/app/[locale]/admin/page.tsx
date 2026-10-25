import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localeMeta, routing } from "@/i18n/routing";
import { adminAccess } from "@/lib/auth/admin";
import { databaseConfigured } from "@/lib/db";
import { itemMeta, type ItemMeta } from "@/lib/content/db";
import { itemId } from "@/lib/content/rows";
import { loadContent } from "@/lib/content/source";
import { moduleTitle } from "@/lib/content/store";
import { TRACKS } from "@/lib/content/json";
import type { Translation } from "@/lib/content/types";
import { Notice, PageTitle, Pill } from "@/components/ui";

const LOCALES = routing.locales as readonly string[];

function StatePill({ translation }: { translation?: Pick<Translation, "state" | "aiDraft"> }) {
  return <StateLabel state={translation?.state ?? "missing"} aiDraft={translation?.aiDraft ?? false} />;
}

async function StateLabel({ state, aiDraft }: { state: Translation["state"] | "missing"; aiDraft: boolean }) {
  const t = await getTranslations("admin.state");
  const tone = state === "published" ? "accent" : state === "missing" ? "neutral" : "warn";
  return <Pill tone={tone}>{t(state)}{aiDraft ? ` · ${t("aiDraft")}` : ""}</Pill>;
}

async function Owner({ meta }: { meta?: ItemMeta }) {
  const t = await getTranslations("admin.owner");
  return <span className="text-fg-muted">{t(meta?.origin ?? "files")}</span>;
}

/** Fresh read of everything, drafts included: the console never shows the cached public copy. */
export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Checked again here: the page must never render for someone the layout turned away.
  const access = await adminAccess(locale);
  if (!access.ok) notFound();

  const t = await getTranslations("admin");
  const ta = await getTranslations("article");
  const tl = await getTranslations("learn");
  const f = await getFormatter();
  const [{ snapshot, from, problem }, meta] = await Promise.all([
    loadContent(),
    databaseConfigured() ? itemMeta().catch(() => new Map<string, ItemMeta>()) : Promise.resolve(new Map<string, ItemMeta>()),
  ]);
  const { articles, modules, news } = snapshot;
  const chapters = modules.flatMap((m) => m.chapters);
  const written = chapters.filter((c) => c.translations.some((tr) => tr.state === "published")).length;
  const th = "px-3 py-2 text-start font-medium text-fg-muted";
  const td = "px-3 py-2 align-top";

  return (
    <div className="space-y-10">
      <div>
        <PageTitle title={t("title")} intro={t("intro")} />
        <div className="space-y-3">
          <Notice tone={from === "database" ? "tip" : "warning"}>{t(`source.${from === "database" ? "database" : problem ?? "unavailable"}`)}</Notice>
          <Notice tone="info">{t("comingNext")}</Notice>
          {from === "database" ? (
            <Link href="/admin/articles/new" className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium hover:bg-accent-strong">{t("articles.new")}</Link>
          ) : null}
          <p className="text-sm text-fg-muted">{t("summary", { articles: articles.length, chapters: chapters.length, written, news: news.length })}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">{t("articles.heading")}</h2>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated">
              <tr>
                <th className={th}>{t("articles.title")}</th>
                <th className={th}>{t("articles.category")}</th>
                <th className={th}>{t("articles.published")}</th>
                {LOCALES.map((l) => <th key={l} className={th}>{localeMeta(l).nativeName}</th>)}
                <th className={th}>{t("articles.owner")}</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const source = a.translations.find((tr) => tr.locale === a.sourceLocale) ?? a.translations[0];
                return (
                  <tr key={a.id} className="border-t border-border">
                    <td className={td}>
                      {from === "database" ? (
                        <Link href={`/admin/articles/${a.id}`} className="font-medium underline-offset-4 hover:underline">{source?.title || a.slug}</Link>
                      ) : <span className="font-medium">{source?.title || a.slug}</span>}
                      <div className="text-xs text-fg-muted">
                        {a.slug}
                        {a.translations.some((tr) => tr.state === "published") ? <> · <Link href={`/articles/${a.slug}`} className="underline underline-offset-4">{t("articles.view")}</Link></> : null}
                      </div>
                    </td>
                    <td className={td}>{ta(`category.${a.category}`)}</td>
                    <td className={`${td} whitespace-nowrap`}>{f.dateTime(new Date(a.publishedAt), { dateStyle: "medium" })}</td>
                    {LOCALES.map((l) => <td key={l} className={td}><StatePill translation={a.translations.find((tr) => tr.locale === l)} /></td>)}
                    <td className={td}><Owner meta={meta.get(itemId.article(a))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-1">{t("learn.heading")}</h2>
        {from === "database" ? <p className="text-sm text-fg-muted mb-3">{t("learn.hint")}</p> : null}
        <div className="space-y-6">
          {TRACKS.map((track) => {
            const mods = modules.filter((m) => m.track === track);
            return (
              <div key={track}>
                <h3 className="font-semibold mb-2">{tl(`track.${track}.title`)}</h3>
                <div className="overflow-x-auto rounded-card border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-elevated">
                      <tr>
                        <th className={th}>{t("learn.module")}</th>
                        <th className={th}>{t("learn.chapters")}</th>
                        {LOCALES.map((l) => <th key={l} className={th}>{t("learn.publishedIn", { language: localeMeta(l).nativeName })}</th>)}
                        <th className={th}>{t("articles.owner")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mods.map((m) => (
                        <tr key={m.slug} className="border-t border-border">
                          <td className={td}>
                            <Link href={from === "database" ? `/admin/learn/${m.track}/${m.slug}` : `/learn/${m.track}/${m.slug}`} className="font-medium underline-offset-4 hover:underline">{moduleTitle(m, locale)?.title ?? m.slug}</Link>
                          </td>
                          <td className={td}>{m.chapters.length}</td>
                          {LOCALES.map((l) => (
                            <td key={l} className={td}>{m.chapters.filter((c) => c.translations.some((tr) => tr.locale === l && tr.state === "published")).length} / {m.chapters.length}</td>
                          ))}
                          <td className={td}><Owner meta={meta.get(itemId.module(m))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-xl font-semibold me-auto">{t("news.heading")}</h2>
          {from === "database" ? <Link href="/admin/news/new" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent-soft">{t("news.new")}</Link> : null}
        </div>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated">
              <tr>
                <th className={th}>{t("news.date")}</th>
                <th className={th}>{t("news.title")}</th>
                {LOCALES.map((l) => <th key={l} className={th}>{localeMeta(l).nativeName}</th>)}
                <th className={th}>{t("news.source")}</th>
                <th className={th}>{t("articles.owner")}</th>
              </tr>
            </thead>
            <tbody>
              {news.map((n) => (
                <tr key={n.id} className="border-t border-border">
                  <td className={`${td} whitespace-nowrap`}>{f.dateTime(new Date(n.date), { dateStyle: "medium" })}</td>
                  <td className={td}>
                    {from === "database" ? (
                      <Link href={`/admin/news/${n.id}`} className="underline-offset-4 hover:underline">{(n.translations.find((tr) => tr.locale === routing.defaultLocale) ?? n.translations[0])?.title}</Link>
                    ) : (n.translations.find((tr) => tr.locale === routing.defaultLocale) ?? n.translations[0])?.title}
                  </td>
                  {LOCALES.map((l) => (
                    <td key={l} className={td}><StateLabel state={n.translations.some((tr) => tr.locale === l) ? "published" : "missing"} aiDraft={false} /></td>
                  ))}
                  <td className={td}><a href={n.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{n.source.name}</a></td>
                  <td className={td}><Owner meta={meta.get(itemId.news(n))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
