"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useStoredState } from "@/lib/useStoredState";

/**
 * Reading aids for chapters, kept in this browser only: which chapters were read to
 * the end, and the last chapter opened, so the Learn page can offer "Continue".
 * Keys are "track/module/chapter" paths without the locale.
 */
const READ_KEY = "mm.chaptersRead";
const LAST_KEY = "mm.lastChapter";

type Last = { path: string; title: string };

/** A thin bar under the header that fills as the reader scrolls through the chapter. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-1 no-print">
      <div className="read-progress h-full bg-accent" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/** Remembers this chapter as the last one opened, and marks it read once the end comes into view. */
export function ChapterTracker({ path, title }: { path: string; title: string }) {
  const [read, setRead] = useStoredState<string[]>(READ_KEY, []);
  const [, setLast] = useStoredState<Last | null>(LAST_KEY, null);
  const ref = useRef<HTMLSpanElement>(null);
  const done = read.includes(path);

  useEffect(() => {
    setLast({ path, title });
  }, [path, title, setLast]);

  useEffect(() => {
    if (done || !ref.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRead([...read.filter((p) => p !== path), path]);
        io.disconnect();
      }
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [done, path, read, setRead]);

  return <span ref={ref} aria-hidden />;
}

/** A tick beside chapters this browser has read to the end. */
export function ReadTick({ path }: { path: string }) {
  const t = useTranslations("learn");
  const [read] = useStoredState<string[]>(READ_KEY, []);
  if (!read.includes(path)) return null;
  return (
    <span className="text-accent shrink-0" title={t("readMark")}>
      <span aria-hidden>✓</span>
      <span className="sr-only">{t("readMark")}</span>
    </span>
  );
}

/** "Continue: <chapter>" for a returning reader; renders nothing on a first visit. */
export function ContinueReading() {
  const t = useTranslations("learn");
  const [last] = useStoredState<Last | null>(LAST_KEY, null);
  if (!last?.path || !last.title) return null;
  return (
    <p className="mb-6">
      <Link href={`/learn/${last.path}`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">
        {t("continueReading", { title: last.title })} <span aria-hidden>→</span>
      </Link>
    </p>
  );
}
