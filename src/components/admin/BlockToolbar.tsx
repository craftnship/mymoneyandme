"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Block } from "@/lib/content/types";
import { uploadImageAction } from "@/lib/content/actions";

/**
 * The settings a block shares across every language (heading level, list
 * numbering, callout tone, calculator, number of rows, items and options,
 * quiz answers). `onShared` applies the change to each language's copy.
 */
const btn = "rounded-md border border-border px-2 py-1 text-xs hover:bg-accent-soft disabled:opacity-40";
const sel = "rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs";

export function BlockToolbar({ block, onShared, calculators }: { block: Block; onShared: (change: (b: Block) => Block) => void; calculators: { slug: string; name: string }[] }) {
  const t = useTranslations("admin.editor.toolbar");
  const add = t("add");
  const removeLast = t("removeLast");

  switch (block.type) {
    case "heading":
      return (
        <select aria-label={t("level")} className={sel} value={block.level} onChange={(e) => { const level = Number(e.target.value) as 2 | 3; onShared((b) => (b.type === "heading" ? { ...b, level } : b)); }}>
          <option value={2}>{t("level2")}</option>
          <option value={3}>{t("level3")}</option>
        </select>
      );
    case "callout":
      return (
        <select aria-label={t("tone")} className={sel} value={block.tone} onChange={(e) => { const tone = e.target.value as "info" | "tip" | "warning"; onShared((b) => (b.type === "callout" ? { ...b, tone } : b)); }}>
          <option value="tip">{t("toneTip")}</option>
          <option value="info">{t("toneInfo")}</option>
          <option value="warning">{t("toneWarning")}</option>
        </select>
      );
    case "calculator":
      return (
        <select aria-label={t("calculator")} className={sel} value={block.slug} onChange={(e) => { const slug = e.target.value; onShared((b) => (b.type === "calculator" ? { ...b, slug } : b)); }}>
          {calculators.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      );
    case "list":
    case "takeaways":
      return (
        <span className="flex flex-wrap items-center gap-2">
          {block.type === "list" ? (
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={Boolean(block.ordered)} onChange={(e) => { const ordered = e.target.checked || undefined; onShared((b) => (b.type === "list" ? { ...b, ordered } : b)); }} />
              {t("numbered")}
            </label>
          ) : null}
          <button type="button" className={btn} onClick={() => onShared((b) => ("items" in b && (b.type === "list" || b.type === "takeaways") ? { ...b, items: [...b.items, ""] } : b))}>{add} {t("itemNoun")}</button>
          <button type="button" className={btn} disabled={block.items.length <= 1} onClick={() => onShared((b) => (b.type === "list" || b.type === "takeaways" ? { ...b, items: b.items.slice(0, -1) } : b))}>{removeLast}</button>
        </span>
      );
    case "table":
      return (
        <span className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => onShared((b) => (b.type === "table" ? { ...b, rows: [...b.rows, b.header.map(() => "")] } : b))}>{add} {t("rowNoun")}</button>
          <button type="button" className={btn} disabled={block.rows.length <= 1} onClick={() => onShared((b) => (b.type === "table" ? { ...b, rows: b.rows.slice(0, -1) } : b))}>{t("removeLastRow")}</button>
          <button type="button" className={btn} disabled={block.header.length >= 12} onClick={() => onShared((b) => (b.type === "table" ? { ...b, header: [...b.header, ""], rows: b.rows.map((r) => [...r, ""]) } : b))}>{add} {t("columnNoun")}</button>
          <button type="button" className={btn} disabled={block.header.length <= 1} onClick={() => onShared((b) => (b.type === "table" ? { ...b, header: b.header.slice(0, -1), rows: b.rows.map((r) => r.slice(0, -1)) } : b))}>{t("removeLastColumn")}</button>
        </span>
      );
    case "glossary":
      return (
        <span className="flex gap-2">
          <button type="button" className={btn} onClick={() => onShared((b) => (b.type === "glossary" ? { ...b, terms: [...b.terms, { term: "", definition: "" }] } : b))}>{add} {t("termNoun")}</button>
          <button type="button" className={btn} disabled={block.terms.length <= 1} onClick={() => onShared((b) => (b.type === "glossary" ? { ...b, terms: b.terms.slice(0, -1) } : b))}>{removeLast}</button>
        </span>
      );
    case "faq":
      return (
        <span className="flex gap-2">
          <button type="button" className={btn} onClick={() => onShared((b) => (b.type === "faq" ? { ...b, items: [...b.items, { q: "", a: "" }] } : b))}>{add} {t("questionNoun")}</button>
          <button type="button" className={btn} disabled={block.items.length <= 1} onClick={() => onShared((b) => (b.type === "faq" ? { ...b, items: b.items.slice(0, -1) } : b))}>{removeLast}</button>
        </span>
      );
    case "quiz":
      return (
        <span className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => onShared((b) => (b.type === "quiz" ? { ...b, questions: [...b.questions, { q: "", options: ["", ""], answer: 0 }] } : b))}>{add} {t("questionNoun")}</button>
          <button type="button" className={btn} disabled={block.questions.length <= 1} onClick={() => onShared((b) => (b.type === "quiz" ? { ...b, questions: b.questions.slice(0, -1) } : b))}>{removeLast}</button>
          {block.questions.map((q, k) => (
            <span key={k} className="flex items-center gap-1 rounded-md bg-bg px-1 text-xs">
              {t("questionShort", { n: k + 1 })}
              <select aria-label={t("correctAnswer", { n: k + 1 })} className={sel} value={q.answer} onChange={(e) => { const answer = Number(e.target.value); onShared((b) => (b.type === "quiz" ? { ...b, questions: b.questions.map((x, j) => (j === k ? { ...x, answer } : x)) } : b)); }}>
                {q.options.map((_, oi) => <option key={oi} value={oi}>{String.fromCharCode(65 + oi)}</option>)}
              </select>
              <button type="button" className={btn} disabled={q.options.length >= 8} onClick={() => onShared((b) => (b.type === "quiz" ? { ...b, questions: b.questions.map((x, j) => (j === k ? { ...x, options: [...x.options, ""] } : x)) } : b))}>+</button>
              <button type="button" className={btn} disabled={q.options.length <= 2} onClick={() => onShared((b) => (b.type === "quiz" ? { ...b, questions: b.questions.map((x, j) => (j === k ? { ...x, options: x.options.slice(0, -1), answer: Math.min(x.answer, x.options.length - 2) } : x)) } : b))}>−</button>
            </span>
          ))}
        </span>
      );
    case "image":
      return <ImageControls block={block} onShared={onShared} />;
    default:
      return null;
  }
}

/** Upload or replace the picture (the same file in every language) and switch the caption on or off. */
function ImageControls({ block, onShared }: { block: Extract<Block, { type: "image" }>; onShared: (change: (b: Block) => Block) => void }) {
  const t = useTranslations("admin.editor.toolbar");
  const te = useTranslations("admin.editor.errors.upload");
  const ui = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const res = await uploadImageAction(ui, form);
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (res.ok) onShared((b) => (b.type === "image" ? { ...b, src: res.url } : b));
    else setError(te(res.error));
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail of the upload */}
      {block.src ? <img src={block.src} alt="" className="h-12 w-20 rounded border border-border object-cover" /> : null}
      <label className={`${btn} cursor-pointer`}>
        {busy ? t("uploading") : block.src ? t("replaceImage") : t("uploadImage")}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={block.caption !== undefined} onChange={(e) => { const on = e.target.checked; onShared((b) => (b.type === "image" ? { ...b, caption: on ? (b.caption ?? "") : undefined } : b)); }} />
        {t("caption")}
      </label>
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
