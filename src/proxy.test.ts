// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import projectsData from "@/data/projects.json";
import { UNMATCHED_ROUTE_PATH } from "@/lib/routing/project-slugs";
import { config, proxy } from "./proxy";

const BASE = "http://localhost:3000";

/** Runs Proxy for `path` and returns the rewrite destination path, or null when it passes. */
function rewriteTarget(path: string): string | null {
  const res = proxy(new NextRequest(new URL(path, BASE)));
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (rewrite) return new URL(rewrite, BASE).pathname;
  expect(res.headers.get("x-middleware-next")).toBe("1");
  return null;
}

/** True when Next.js would run Proxy for `url`, judged from the exported `config`. */
function runsFor(url: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url });
}

describe("proxy", () => {
  it.each(["/projects/project-one", "/projects/does-not-exist"])("runs for %s", (url) => {
    expect(runsFor(url)).toBe(true);
  });

  it.each(["/", "/projects", "/projects/a/b", "/api/projects", "/about", "/experience"])(
    "does not run for %s",
    (url) => {
      expect(runsFor(url)).toBe(false);
    },
  );

  it.each(projectsData.map((p) => p.slug))("passes the known slug %s through", (slug) => {
    expect(rewriteTarget(`/projects/${slug}`)).toBeNull();
  });

  it.each(["/projects/does-not-exist", `/projects/${projectsData[0].slug.toUpperCase()}`])(
    "rewrites the unknown project %s to an unmatched route (404)",
    (path) => {
      expect(rewriteTarget(path)).toBe(UNMATCHED_ROUTE_PATH);
    },
  );

  it.each(["/", "/projects", "/projects/does-not-exist/nested", "/api/projects"])(
    "passes %s through if it is ever called for a non-detail path",
    (path) => {
      expect(rewriteTarget(path)).toBeNull();
    },
  );
});
