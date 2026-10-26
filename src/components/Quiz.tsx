"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { QuizQuestion } from "@/lib/content/types";

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const t = useTranslations("learn");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const score = questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <section className="rounded-card border border-border p-5 bg-bg-elevated">
      <h3 className="text-xl font-semibold">{t("quiz")}</h3>
      <ol className="mt-4 space-y-5">
        {questions.map((q, qi) => (
          <li key={qi}>
            <p className="font-medium">{qi + 1}. {q.q}</p>
            <div className="mt-2 grid gap-1.5">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const correct = checked && oi === q.answer;
                const wrong = checked && selected && oi !== q.answer;
                return (
                  <label key={oi} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${correct ? "border-accent bg-accent-soft" : wrong ? "border-danger bg-danger-soft" : "border-border"}`}>
                    <input type="radio" className="size-5 shrink-0 accent-[var(--accent)]" name={`q${qi}`} checked={selected} onChange={() => { setAnswers({ ...answers, [qi]: oi }); setChecked(false); }} />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {checked && q.explanation ? <p className="mt-2 text-sm text-fg-muted">{q.explanation}</p> : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-4">
        <button type="button" onClick={() => setChecked(true)} className="rounded-lg bg-accent text-white px-4 py-2 font-medium hover:bg-accent-strong">
          {t("quizSubmit")}
        </button>
        {checked ? <p aria-live="polite" className="font-medium">{t("quizScore", { score, total: questions.length })}</p> : null}
      </div>
    </section>
  );
}
