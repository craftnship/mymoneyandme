"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Translation } from "@/lib/content/types";
import type { Problem } from "@/lib/content/schema";
import type { SaveResult } from "@/lib/content/actions";
import {
  BLOCK_TYPES, addTranslation, insertBlock, moveBlock, newBlock, patchTranslation, removeBlock, setBlockShared, setBlockText, type BlockType, type Doc,
} from "@/lib/content/editing";
import { BlockFields, fieldClass } from "./BlockFields";
import { BlockToolbar } from "./BlockToolbar";

/**
 * Pieces every editor in the console shares: the edit state with its unsaved
 * warning and save round trip, the per-language cards and block-by-block body
 * of a translated document, and the fixed save bar.
 */
export type Lang = { code: string; name: string; dir: "ltr" | "rtl" };
export type Calc = { slug: string; name: string };

export const btn = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent-soft disabled:opacity-50";
const STATES: Translation["state"][] = ["draft", "inReview", "published"];

export type Status = { tone: "ok" | "error"; text: string; problems?: Problem[] };

export function useEditor<T>(initial: T) {
  const t = useTranslations("admin.editor");
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (v: T) => T) => {
    setValue(fn);
    setDirty(true);
    setStatus(null);
  };

  /** Runs a save action; on success requests the pages it names and hands the result on. */
  const save = (action: () => Promise<SaveResult>, onSaved: (res: Extract<SaveResult, { ok: true }>) => void) =>
    start(async () => {
      const res = await action();
      if (res.ok) {
        // Take the one stale view each public page serves after a change, so readers get the new one.
        for (const path of res.refresh) await fetch(path, { cache: "no-store", credentials: "omit" }).catch(() => undefined);
        setDirty(false);
        setStatus({ tone: "ok", text: t("saved") });
        onSaved(res);
      } else {
        // "invalid" without problems means a field the checks don't name (an empty web address, say).
        const key = res.error === "invalid" && !res.problems?.length ? "invalidFields" : res.error;
        setStatus({ tone: "error", text: t(`errors.${key}`), problems: res.problems });
      }
    });

  return { value, update, dirty, setDirty, status, setStatus, pending, save };
}

export function SaveBar({ onSave, pending, dirty, status, langs, extra }: { onSave: () => void; pending: boolean; dirty: boolean; status: Status | null; langs: Lang[]; extra?: React.ReactNode }) {
  const t = useTranslations("admin.editor");
  const problemText = (p: Problem) => {
    const language = langs.find((l) => l.code === p.locale)?.name ?? p.locale;
    return "block" in p ? t(`problems.${p.code}`, { language, block: p.block + 1 }) : t(`problems.${p.code}`, { language });
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={onSave} disabled={pending} className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong disabled:opacity-60">
          {pending ? t("saving") : t("save")}
        </button>
        {extra}
        <span className="text-sm text-fg-muted">{dirty ? t("unsaved") : null}</span>
        {status ? (
          <div role={status.tone === "error" ? "alert" : "status"} className={`text-sm ${status.tone === "error" ? "text-danger" : "text-accent-strong"}`}>
            {status.text}
            {status.problems?.length ? <ul className="list-disc ps-5">{status.problems.slice(0, 6).map((p, k) => <li key={k}>{problemText(p)}</li>)}</ul> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Every language side by side: title, summary, SEO fields and state per
 * language, then the body block by block. Structure is shared (see
 * src/lib/content/editing.ts), text is per language.
 */
export function TranslatedBody<D extends Doc>({ doc, update, langs, calculators, previewHref }: { doc: D; update: (fn: (d: D) => D) => void; langs: Lang[]; calculators: Calc[]; previewHref?: (lang: string) => string }) {
  const t = useTranslations("admin.editor");
  const [newType, setNewType] = useState<BlockType>("paragraph");
  const shown = langs.filter((l) => doc.translations.some((tr) => tr.locale === l.code));
  const missing = langs.filter((l) => !doc.translations.some((tr) => tr.locale === l.code));
  const source = doc.translations.find((tr) => tr.locale === doc.sourceLocale) ?? doc.translations[0];
  const calcName = (slug: string) => calculators.find((c) => c.slug === slug)?.name ?? slug;
  const cols = shown.length > 1 ? "md:grid-cols-2" : "";

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold me-auto">{t("languages")}</h2>
          {missing.map((l) => (
            <button key={l.code} type="button" className={btn} onClick={() => update((d) => addTranslation(d, l.code))}>{t("startLanguage", { language: l.name })}</button>
          ))}
        </div>
        <div className={`grid gap-4 ${cols}`}>
          {shown.map((l) => {
            const tr = doc.translations.find((x) => x.locale === l.code)!;
            const patch = (p: Partial<Translation>) => update((d) => patchTranslation(d, l.code, p));
            return (
              <div key={l.code} lang={l.code} dir={l.dir} className="rounded-card border border-border p-4 space-y-3">
                <p className="font-semibold">{l.name}{l.code === doc.sourceLocale ? ` · ${t("source")}` : ""}</p>
                <label className="block text-sm"><span className="block mb-1">{t("title")}</span><input value={tr.title} onChange={(e) => patch({ title: e.target.value })} className={fieldClass} /></label>
                <label className="block text-sm"><span className="block mb-1">{t("excerpt")}</span><textarea rows={3} value={tr.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} className={fieldClass} /></label>
                <details className="text-sm">
                  <summary className="cursor-pointer text-fg-muted">{t("seo")}</summary>
                  <div className="mt-2 space-y-2">
                    <label className="block"><span className="block mb-1">{t("seoTitle")}</span><input value={tr.seoTitle ?? ""} onChange={(e) => patch({ seoTitle: e.target.value || undefined })} className={fieldClass} /></label>
                    <label className="block"><span className="block mb-1">{t("seoDescription")}</span><textarea rows={2} value={tr.seoDescription ?? ""} onChange={(e) => patch({ seoDescription: e.target.value || undefined })} className={fieldClass} /></label>
                  </div>
                </details>
                <fieldset className="text-sm">
                  <legend className="mb-1">{t("state")}</legend>
                  <div className="flex flex-wrap gap-3">
                    {STATES.map((s) => (
                      <label key={s} className="flex items-center gap-1">
                        <input type="radio" name={`state-${l.code}`} checked={tr.state === s || (s === "inReview" && tr.state === "approved")} onChange={() => patch({ state: s })} />
                        {t(`states.${s}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={tr.aiDraft} onChange={(e) => patch({ aiDraft: e.target.checked })} />
                  {t("aiDraft")}
                </label>
                {previewHref ? (
                  <Link href={previewHref(l.code)} target="_blank" className="inline-block text-sm underline underline-offset-4">{t("preview", { language: l.name })}</Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("body")}</h2>
        <p className="text-sm text-fg-muted">{t("bodyHint")}</p>
        {(source?.blocks ?? []).map((b, i) => (
          <div key={i} className="rounded-card border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{i + 1}. {t(`blockTypes.${b.type}`)}</span>
              <BlockToolbar block={b} calculators={calculators} onShared={(change) => update((d) => setBlockShared(d, i, change))} />
              <span className="ms-auto flex gap-1">
                <button type="button" className={btn} aria-label={t("moveUp")} disabled={i === 0} onClick={() => update((d) => moveBlock(d, i, -1))}>↑</button>
                <button type="button" className={btn} aria-label={t("moveDown")} disabled={i === (source?.blocks.length ?? 0) - 1} onClick={() => update((d) => moveBlock(d, i, 1))}>↓</button>
                <button type="button" className={btn} aria-label={t("removeBlock")} onClick={() => update((d) => removeBlock(d, i))}>✕</button>
              </span>
            </div>
            <div className={`grid gap-4 ${cols}`}>
              {shown.map((l) => {
                const tr = doc.translations.find((x) => x.locale === l.code)!;
                const block = tr.blocks[i];
                if (!block) return <p key={l.code} className="text-sm text-danger">{t("problems.structureDiffers", { language: l.name, block: i + 1 })}</p>;
                return (
                  <div key={l.code} lang={l.code}>
                    {shown.length > 1 ? <p className="text-xs text-fg-muted mb-1">{l.name}</p> : null}
                    <BlockFields block={block} lang={l.code} dir={l.dir} calculatorName={calcName} onChange={(nb) => update((d) => setBlockText(d, l.code, i, nb))} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t("blockType")} value={newType} onChange={(e) => setNewType(e.target.value as BlockType)} className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm">
            {BLOCK_TYPES.map((bt) => <option key={bt} value={bt}>{t(`blockTypes.${bt}`)}</option>)}
          </select>
          <button type="button" className={btn} onClick={() => update((d) => insertBlock(d, source?.blocks.length ?? 0, newBlock(newType, calculators[0]?.slug)))}>{t("addBlock")}</button>
        </div>
      </section>
    </>
  );
}
