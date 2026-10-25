import { getTranslations, getFormatter } from "next-intl/server";
import type { NewsItem } from "@/lib/content/types";
import { newsText } from "@/lib/content/store";
import { Pill } from "./ui";

export async function NewsList({ items, locale }: { items: NewsItem[]; locale: string }) {
  const t = await getTranslations("home");
  const ta = await getTranslations("article");
  const f = await getFormatter();

  return (
    <section id="news" aria-labelledby="news-heading" className="rounded-card border border-border bg-bg-elevated p-5 scroll-mt-24">
      <h2 id="news-heading" className="text-xl font-semibold tracking-tight flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full bg-danger" aria-hidden />
        {t("newsTitle")}
      </h2>
      <ol className="mt-4 divide-y divide-border">
        {items.map((n) => {
          const text = newsText(n, locale);
          return (
            <li key={n.id} className="py-4 first:pt-0 last:pb-0">
              <article>
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <Pill tone="accent">{ta(`category.${n.category}`)}</Pill>
                  <time dateTime={n.date}>{f.dateTime(new Date(n.date), { dateStyle: "medium" })}</time>
                </div>
                <h3 className="mt-2 font-semibold leading-snug">{text.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{text.summary}</p>
                <p className="mt-2 text-xs">
                  <a href={n.source.url} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline underline-offset-4">
                    {t("newsSource", { name: n.source.name })}
                  </a>
                </p>
              </article>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-fg-muted">{t("newsNote")}</p>
    </section>
  );
}
