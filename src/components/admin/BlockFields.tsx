"use client";

import { useTranslations } from "next-intl";
import type { Block } from "@/lib/content/types";

/**
 * One language's text fields for one block. Structure (adding a row, an
 * option, a list item) is changed in the toolbar above, for every language at
 * once; this component only edits the words.
 */
export const fieldClass = "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm";

function Area({ value, onChange, rows = 3, label, dir }: { value: string; onChange: (v: string) => void; rows?: number; label: string; dir?: string }) {
  return <textarea aria-label={label} value={value} rows={rows} dir={dir} onChange={(e) => onChange(e.target.value)} className={fieldClass} />;
}

function Line({ value, onChange, label, dir, placeholder }: { value: string; onChange: (v: string) => void; label: string; dir?: string; placeholder?: string }) {
  return <input aria-label={label} value={value} dir={dir} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={fieldClass} />;
}

export function BlockFields({ block, onChange, calculatorName, lang, dir }: { block: Block; onChange: (b: Block) => void; calculatorName: (slug: string) => string; lang: string; dir?: string }) {
  const t = useTranslations("admin.editor.fields");
  const set = (patch: object) => onChange({ ...block, ...patch } as Block);
  const common = { dir };

  switch (block.type) {
    case "heading":
      return <Line {...common} label={t("heading")} value={block.text} onChange={(text) => set({ text })} />;
    case "paragraph":
    case "activity":
      return <Area {...common} label={t("text")} rows={4} value={block.text} onChange={(text) => set({ text })} />;
    case "callout":
      return <Area {...common} label={t("text")} rows={2} value={block.text} onChange={(text) => set({ text })} />;
    case "quote":
      return (
        <div className="space-y-2" lang={lang}>
          <Area {...common} label={t("quote")} rows={2} value={block.text} onChange={(text) => set({ text })} />
          <Line {...common} label={t("cite")} placeholder={t("cite")} value={block.cite ?? ""} onChange={(cite) => set({ cite: cite || undefined })} />
        </div>
      );
    case "list":
    case "takeaways":
      return (
        <ol className="space-y-2 list-decimal ps-5">
          {block.items.map((it, k) => (
            <li key={k}><Line {...common} label={t("item", { n: k + 1 })} value={it} onChange={(v) => set({ items: block.items.map((x, j) => (j === k ? v : x)) })} /></li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>{block.header.map((h, c) => <th key={c} className="p-1"><Line {...common} label={t("column", { n: c + 1 })} value={h} onChange={(v) => set({ header: block.header.map((x, j) => (j === c ? v : x)) })} /></th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="p-1"><Line {...common} label={t("cell", { row: r + 1, col: c + 1 })} value={cell} onChange={(v) => set({ rows: block.rows.map((x, j) => (j === r ? x.map((y, k) => (k === c ? v : y)) : x)) })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "calculator":
      return <p className="text-sm text-fg-muted">{t("calculatorEmbed", { name: calculatorName(block.slug) })}</p>;
    case "glossary":
      return (
        <div className="space-y-3">
          {block.terms.map((g, k) => (
            <div key={k} className="space-y-1">
              <Line {...common} label={t("term", { n: k + 1 })} placeholder={t("term", { n: k + 1 })} value={g.term} onChange={(v) => set({ terms: block.terms.map((x, j) => (j === k ? { ...x, term: v } : x)) })} />
              <Area {...common} label={t("definition", { n: k + 1 })} rows={2} value={g.definition} onChange={(v) => set({ terms: block.terms.map((x, j) => (j === k ? { ...x, definition: v } : x)) })} />
            </div>
          ))}
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          {block.items.map((f, k) => (
            <div key={k} className="space-y-1">
              <Line {...common} label={t("question", { n: k + 1 })} placeholder={t("question", { n: k + 1 })} value={f.q} onChange={(v) => set({ items: block.items.map((x, j) => (j === k ? { ...x, q: v } : x)) })} />
              <Area {...common} label={t("answer", { n: k + 1 })} rows={2} value={f.a} onChange={(v) => set({ items: block.items.map((x, j) => (j === k ? { ...x, a: v } : x)) })} />
            </div>
          ))}
        </div>
      );
    case "quiz":
      return (
        <div className="space-y-4">
          {block.questions.map((q, k) => {
            const setQ = (patch: Partial<typeof q>) => set({ questions: block.questions.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
            return (
              <div key={k} className="space-y-1 rounded-lg border border-border p-2">
                <Line {...common} label={t("question", { n: k + 1 })} placeholder={t("question", { n: k + 1 })} value={q.q} onChange={(v) => setQ({ q: v })} />
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className={`w-5 text-xs ${oi === q.answer ? "font-bold text-accent-strong" : "text-fg-muted"}`}>{String.fromCharCode(65 + oi)}</span>
                    <Line {...common} label={t("option", { n: oi + 1 })} value={o} onChange={(v) => setQ({ options: q.options.map((x, j) => (j === oi ? v : x)) })} />
                  </div>
                ))}
                <Area {...common} label={t("explanation")} rows={2} value={q.explanation ?? ""} onChange={(v) => setQ({ explanation: v || undefined })} />
              </div>
            );
          })}
        </div>
      );
  }
}
