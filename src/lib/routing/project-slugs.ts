import projectsData from "@/data/projects.json";
import { projectListSchema } from "@/lib/schemas";

/**
 * Path Proxy rewrites unknown project URLs to. It matches no route (a leading `_` marks a
 * private folder in the App Router, so it can never become one), so Next.js renders the
 * app's not-found page with a real 404 status while the browser keeps the original URL.
 */
export const UNMATCHED_ROUTE_PATH = "/_unknown-project";

/**
 * Returns the project slugs in `source`, or `null` when the data fails validation.
 * On `null`, callers should let the request through so the page reports the content error.
 *
 * This reads the bundled JSON directly (not `getRepository()`): Proxy runs outside the
 * React Server environment, so it cannot import `server-only` modules. When content moves
 * to a CMS or API, swap this for a cached slug lookup from that source.
 *
 * @param source Raw project list; defaults to `src/data/projects.json` (override in tests).
 */
export function loadKnownProjectSlugs(source: unknown = projectsData): ReadonlySet<string> | null {
  const parsed = projectListSchema.safeParse(source);
  return parsed.success ? new Set(parsed.data.map((project) => project.slug)) : null;
}

/**
 * Extracts the slug from a `/projects/<slug>` pathname, percent-decoded the same way
 * Next.js decodes route params. Returns `undefined` for any other path (the list page,
 * deeper paths) and `null` when the segment is not valid percent-encoding.
 * A single trailing slash is ignored.
 */
export function projectSlugFromPath(pathname: string): string | null | undefined {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * True when `pathname` is a project detail URL whose slug is not one of `knownSlugs`
 * (exact, case-sensitive match). Malformed encodings count as unknown. Returns false for
 * other paths, and when `knownSlugs` is `null` (content failed validation).
 */
export function isUnknownProjectPath(
  pathname: string,
  knownSlugs: ReadonlySet<string> | null,
): boolean {
  if (!knownSlugs) return false;
  const slug = projectSlugFromPath(pathname);
  if (slug === undefined) return false;
  return slug === null || !knownSlugs.has(slug);
}
