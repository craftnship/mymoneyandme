import { getTranslations } from "next-intl/server";
import type { NewsItem } from "@/lib/content/types";
import { newsText } from "@/lib/content/store";

/** The "Latest" strip at the top of the home page. Scrolls unless the reader asks for reduced motion; then it is a plain scrollable row. */
export async function NewsTicker({ items, locale }: { items: NewsItem[]; locale: string }) {
  const t = await getTranslations("home");
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pe-8" aria-hidden={hidden || undefined}>
      {items.map((n) => (
        <li key={n.id} className="whitespace-nowrap">
          <a href="#news" tabIndex={hidden ? -1 : undefined} className="hover:underline underline-offset-4">
            {newsText(n, locale).title}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex items-stretch rounded-card border border-border bg-bg-elevated overflow-hidden text-sm">
      <p className="shrink-0 bg-accent text-white font-semibold px-4 py-2.5 flex items-center">{t("tickerLabel")}</p>
      <div className="ticker relative flex-1 overflow-hidden py-2.5 ps-4">
        <div className="ticker-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
