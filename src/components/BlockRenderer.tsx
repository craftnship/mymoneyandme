import { getTranslations } from "next-intl/server";
import type { Block } from "@/lib/content/types";
import { resolvePlaceholders } from "@/lib/rulepack";
import { Notice } from "./ui";
import { Quiz } from "./Quiz";
import { CalculatorEmbed } from "./CalculatorEmbed";

/** Renders content blocks (section 12); placeholders resolve against the rule pack. */
export async function BlockRenderer({ blocks, kids = false }: { blocks: Block[]; kids?: boolean }) {
  const t = await getTranslations();
  const p = (s: string) => resolvePlaceholders(s);
  return (
    <div className={`prose-like space-y-5 ${kids ? "text-lg" : ""}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? <h2 key={i} className="text-2xl font-semibold tracking-tight mt-8">{p(b.text)}</h2> : <h3 key={i} className="text-xl font-semibold mt-6">{p(b.text)}</h3>;
          case "paragraph":
            return <p key={i} className="leading-relaxed">{p(b.text)}</p>;
          case "list":
            return b.ordered ? (
              <ol key={i} className="list-decimal ps-6 space-y-2">{b.items.map((it, k) => <li key={k}>{p(it)}</li>)}</ol>
            ) : (
              <ul key={i} className="list-disc ps-6 space-y-2">{b.items.map((it, k) => <li key={k}>{p(it)}</li>)}</ul>
            );
          case "callout":
            return <Notice key={i} tone={b.tone}>{p(b.text)}</Notice>;
          case "quote":
            return <blockquote key={i} className="border-s-4 border-accent ps-4 italic text-fg-muted">{p(b.text)}{b.cite ? <cite className="block not-italic text-sm mt-1">{b.cite}</cite> : null}</blockquote>;
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
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
          default:
            return null;
        }
      })}
    </div>
  );
}
