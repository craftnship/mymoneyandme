import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    out[k] = typeof v === "object" && v !== null && typeof b === "object" && b !== null ? deepMerge(b, v) : v;
  }
  return out;
}

// Member-app areas keep their strings in their own files so the public-site
// file stays small; each file holds one top-level namespace.
const AREAS = ["app-data", "app-checkup", "app-settings"] as const;

async function loadMessages(locale: string): Promise<Messages> {
  let merged: Messages = (await import(`../../messages/${locale}.json`)).default;
  for (const area of AREAS) {
    const extra = (await import(`../../messages/${area}.${locale}.json`)).default as Messages;
    merged = deepMerge(merged, extra);
  }
  return merged;
}

export default getRequestConfig(async () => {
  // The [locale] root segment is the single source of truth for the request
  // language; falling back keeps unknown paths (e.g. /favicon.txt) renderable.
  const candidate = await rootLocale();
  const locale = hasLocale(routing.locales, candidate)
    ? candidate
    : routing.defaultLocale;

  // English is the source language for every UI string; a locale file that is
  // missing a key falls back to the English string rather than the raw key.
  const base = await loadMessages("en");
  const own = locale === "en" ? base : await loadMessages(locale);

  return {
    locale,
    messages: deepMerge(base, own),
    timeZone: "Asia/Kolkata",
    // Indian grouping (1,00,000) is the default for every language (section 13).
    formats: {
      number: {
        inr: {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
          numberingSystem: "latn",
        },
        percent: { style: "percent", maximumFractionDigits: 1 },
      },
    },
  };
});
