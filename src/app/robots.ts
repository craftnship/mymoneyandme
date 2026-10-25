import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", ...routing.locales.map((l) => `/${l}/admin`)] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
