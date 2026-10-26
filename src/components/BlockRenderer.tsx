import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Block } from "@/lib/content/types";
import { resolvePlaceholders } from "@/lib/rulepack";
import { Notice } from "./ui";
import { Quiz } from "./Quiz";
import { CalculatorEmbed } from "./CalculatorEmbed";

/** The id each level-2 heading gets, so a table of contents can link to it. */
export function sectionId(n: number) {
  return `sec-${n}`;
}

/** Level-2 headings in order, with the ids BlockRenderer gives them. */
export function blockSections(blocks: Block[]) {
  return blocks
    .filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.level === 2)
    .map((b, n) => ({ id: sectionId(n + 1), text: resolvePlaceholders(b.text) }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Links the first use of each glossary term in the running text to a small popover
 * with its definition. Latin terms need a word boundary on both sides (a plural "s"
 * is allowed); Tamil terms only at the start, because Tamil adds case endings.
 */
function glossaryLinker(blocks: Block[]) {
  const terms = blocks.flatMap((b) => (b.type === "glossary" ? b.terms : []));
  if (!terms.length) return (text: string) => text as ReactNode;
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  const re = new RegExp(
    sorted.map((g) => `(?<![\\p{L}\\p{M}\\p{N}])${escapeRe(g.term)}${/^[\p{Script=Latin}\d\s.'()-]+$/u.test(g.term) ? "s?(?![\\p{L}\\p{M}\\p{N}])" : ""}`).join("|"),
    "giu",
  );
  const used = new Set<string>();
  let n = 0;
  return (text: string): ReactNode => {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      const g = sorted.find((x) => m[0].toLocaleLowerCase().startsWith(x.term.toLocaleLowerCase()));
      if (!g || used.has(g.term)) continue;
      used.add(g.term);
      const id = `gloss-${++n}`;
      out.push(text.slice(last, m.index));
      out.push(
        <span key={id}>
          <button type="button" popoverTarget={id} className="gloss-term">{m[0]}</button>
          <span id={id} popover="auto" role="note" className="gloss-pop">
            <strong className="block">{g.term}</strong>
            <span className="block mt-1 text-fg-muted">{resolvePlaceholders(g.definition)}</span>
          </span>
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (!out.length) return text;
    out.push(text.slice(last));
    return out;
  };
}

/** Renders content blocks (section 12); placeholders resolve against the rule pack. */
export async function BlockRenderer({ blocks, kids = false }: { blocks: Block[]; kids?: boolean }) {
  const t = await getTranslations();
  const p = (s: string) => resolvePlaceholders(s);
  const linked = glossaryLinker(blocks);
  const pl = (s: string) => linked(p(s));
  let h2 = 0;
  return (
    <div className={`reading space-y-5 ${kids ? "reading-kids" : ""}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? <h2 key={i} id={sectionId(++h2)} className="text-2xl font-semibold tracking-tight pt-6">{p(b.text)}</h2> : <h3 key={i} className="text-xl font-semibold pt-3">{p(b.text)}</h3>;
          case "paragraph":
            return <p key={i}>{pl(b.text)}</p>;
          case "list":
            return b.ordered ? (
              <ol key={i} className="list-decimal ps-6 space-y-2.5">{b.items.map((it, k) => <li key={k}>{pl(it)}</li>)}</ol>
            ) : (
              <ul key={i} className="list-disc ps-6 space-y-2.5">{b.items.map((it, k) => <li key={k}>{pl(it)}</li>)}</ul>
            );
          case "callout":
            return (
              <Notice key={i} tone={b.tone} size="body">
                <span className="block text-sm font-semibold uppercase tracking-wide text-fg-muted">{t(`article.callout.${b.tone}`)}</span>
                <span className="block mt-1">{p(b.text)}</span>
              </Notice>
            );
          case "quote":
            return <blockquote key={i} className="border-s-4 border-accent ps-4 italic text-fg-muted">{p(b.text)}{b.cite ? <cite className="block not-italic text-sm mt-1">{b.cite}</cite> : null}</blockquote>;
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full text-base border-collapse tabular-nums">
                  <thead><tr>{b.header.map((h, k) => <th key={k} className="text-start border-b border-border py-2 pe-4 font-semibold">{p(h)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((c, k) => <td key={k} className="border-b border-border py-2 pe-4">{p(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case "calculator":
            return <CalculatorEmbed key={i} slug={b.slug} />;
          case "takeaways":
            return (
              <section key={i} className="rounded-card border border-accent/30 bg-accent-soft p-5">
                <p className="font-semibold">{t("article.takeaways")}</p>
                <ul className="mt-2 list-disc ps-5 space-y-1">{b.items.map((it, k) => <li key={k}>{p(it)}</li>)}</ul>
              </section>
            );
          case "glossary":
            return (
              <section key={i} className="rounded-card border border-border p-5">
                <p className="font-semibold">{t("article.glossary")}</p>
                <dl className="mt-3 grid gap-3">
                  {b.terms.map((g, k) => (
                    <div key={k}><dt className="font-medium">{g.term}</dt><dd className="text-fg-muted">{p(g.definition)}</dd></div>
                  ))}
                </dl>
              </section>
            );
          case "quiz":
            return <Quiz key={i} questions={b.questions} />;
          case "activity":
            return (
              <section key={i} className="rounded-card border-2 border-dashed border-warn/50 bg-warn-soft p-5">
                <p className="font-semibold">{t("learn.activity")}</p>
                <p className="mt-1">{p(b.text)}</p>
              </section>
            );
          case "faq":
            return (
              <div key={i} className="space-y-2">
                {b.items.map((f, k) => (
                  <details key={k} className="rounded-xl border border-border p-4"><summary className="font-medium cursor-pointer">{p(f.q)}</summary><p className="mt-2 text-fg-muted">{p(f.a)}</p></details>
                ))}
              </div>
            );
          case "image":
            return b.src ? (
              <figure key={i} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploads are served as-is from /media */}
                <img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-card border border-border" />
                {b.caption ? <figcaption className="text-[0.9375rem] text-fg-muted">{p(b.caption)}</figcaption> : null}
              </figure>
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
}
