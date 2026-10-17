/**
 * INR formatting with Indian grouping and lakh/crore words (section 13).
 * The "international" toggle switches to thousands/millions grouping.
 */
export type Grouping = "indian" | "international";

export function formatINR(
  amount: number,
  opts: { grouping?: Grouping; decimals?: number; locale?: string } = {},
): string {
  const { grouping = "indian", decimals = 0, locale = "en" } = opts;
  const intlLocale = grouping === "indian" ? `${locale}-IN` : "en-US";
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    numberingSystem: "latn",
  }).format(abs);
  return `${amount < 0 ? "-" : ""}₹${formatted}`;
}

/** 1,50,00,000 → "₹1.5 Cr"; 2,50,000 → "₹2.5 L"; 45,000 → "₹45,000". */
export function formatINRCompact(amount: number, grouping: Grouping = "indian"): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (grouping === "international") {
    if (abs >= 1e9) return `${sign}₹${trim(abs / 1e9)}B`;
    if (abs >= 1e6) return `${sign}₹${trim(abs / 1e6)}M`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
    return formatINR(amount, { grouping });
  }
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  return formatINR(amount, { grouping });
}

function trim(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals).replace(/\.?0+$/, "")}%`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
