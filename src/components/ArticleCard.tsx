import Image from "next/image";
import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Article } from "@/lib/content/types";
import { DEFAULT_COVER, readingMinutes, resolveTranslation } from "@/lib/content/store";
import { localeMeta } from "@/i18n/routing";
import { Pill } from "./ui";

/** `heading` keeps the outline valid: h2 directly under a page title, h3 inside a titled section. */
export async function ArticleCard({ article, locale, large = false, heading = "h3" }: { article: Article; locale: string; large?: boolean; heading?: "h2" | "h3" }) {
  const Heading = heading;
  const t = await getTranslations("article");
  const th = await getTranslations("home");
  const f = await getFormatter();
  const r = resolveTranslation(article.translations, locale);
  if (!r) return null;
  const { translation, fallback } = r;

  return (
    <article className="group rounded-card border border-border bg-bg-elevated overflow-hidden flex flex-col hover:border-accent transition-colors">
      {/* Decorative: the title right below says what the article is. */}
      <Image
        src={article.cover ?? DEFAULT_COVER}
        alt=""
        width={1200}
        height={675}
        unoptimized
        priority={large}
        className="w-full aspect-[16/9] object-cover"
      />
      <div className={`p-5 flex flex-col gap-3 flex-1 ${large ? "md:p-7" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Pill tone="accent">{t(`category.${article.category}`)}</Pill>
          <Pill>{t(`format.${article.format}`)}</Pill>
          {fallback ? <Pill tone="warn">{localeMeta(r.locale).nativeName}</Pill> : null}
          {translation.aiDraft ? <Pill tone="warn">AI</Pill> : null}
        </div>
        <Heading className={`font-semibold tracking-tight ${large ? "text-2xl sm:text-3xl" : "text-lg"}`}>
          <Link href={`/articles/${article.slug}`} className="hover:underline underline-offset-4">
            {translation.title}
          </Link>
        </Heading>
        <p className="text-fg-muted">{translation.excerpt}</p>
        <p className="mt-auto text-xs text-fg-muted">
          {article.author} · {f.dateTime(new Date(article.publishedAt), { dateStyle: "medium" })} · {th("minRead", { minutes: readingMinutes(translation) })}
        </p>
      </div>
    </article>
  );
}
