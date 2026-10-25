import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE } from "./lib/auth/cookie";

const intl = createMiddleware(routing);

// Member-app pages that work without a session.
const PUBLIC_APP = new Set(["sign-in", "sign-up", "forgot", "reset"]);

/**
 * Detects the visitor's language from the cookie or Accept-Language header and
 * redirects bare paths to the prefixed version (section 13). For /app and
 * /admin pages it also performs the optimistic auth check: no session cookie at all means a
 * redirect to sign-in without touching the database. Pages still verify the
 * session properly; this only keeps obvious misses cheap.
 */
export default function proxy(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/([a-z]{2})\/(app|admin)(?:\/([^/]+))?/);
  if (m && !(m[2] === "app" && PUBLIC_APP.has(m[3] ?? "")) && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${m[1]}/app/sign-in`;
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = {
  matcher: [
    // Skip API routes, uploaded images (/media), Next internals, static files and the sitemap/robots files.
    "/((?!api|media|_next|_vercel|.*\\..*).*)",
  ],
};
