import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Detects the visitor's language from the cookie or Accept-Language header and
// redirects bare paths to the prefixed version (section 13).
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Skip API routes, Next internals, static files and the sitemap/robots files.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
