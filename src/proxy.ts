import { NextResponse, type NextRequest } from "next/server";
import {
  UNMATCHED_ROUTE_PATH,
  isUnknownProjectPath,
  loadKnownProjectSlugs,
} from "@/lib/routing/project-slugs";

/** Slugs of the bundled projects, validated once when Proxy loads. */
const knownSlugs = loadKnownProjectSlugs();

/**
 * Answers unknown `/projects/<slug>` URLs with a real HTTP 404.
 *
 * With Cache Components the detail page streams its static shell (status 200) before its
 * request-time `notFound()` runs, so the page alone cannot set a 404. Proxy runs before
 * rendering: it rewrites unknown slugs to a path that matches no route, which makes
 * Next.js render the app's not-found page with status 404 (the URL in the browser stays
 * the same). Known slugs pass through untouched.
 */
export function proxy(request: NextRequest): NextResponse {
  if (isUnknownProjectPath(request.nextUrl.pathname, knownSlugs)) {
    return NextResponse.rewrite(new URL(UNMATCHED_ROUTE_PATH, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Only project detail pages; the list page, API routes and assets skip Proxy entirely.
  matcher: "/projects/:slug",
};
