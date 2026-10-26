import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, localeMeta } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-tamil";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    title: { default: `${t("name")}: ${t("tagline")}`, template: `%s | ${t("name")}` },
    description: t("description"),
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in"),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { siteName: t("name"), locale, type: "website", images: [{ url: "/og/default.png", width: 1200, height: 630, alt: t("name") }] },
    twitter: { card: "summary_large_image" },
    manifest: "/manifest.webmanifest",
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const meta = localeMeta(locale);
  const t = await getTranslations({ locale, namespace: "site" });

  return (
    <html lang={locale} dir={meta.dir} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-bg-elevated focus:px-3 focus:py-2">
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
