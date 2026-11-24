// @vitest-environment node
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

describe("proxy", () => {
  it("is scoped to project detail pages", () => {
    expect(config.matcher).toBe("/projects/:slug");
  });

  it.each(projectsData.map((p) => p.slug))("passes the known slug %s through", (slug) => {
    expect(rewriteTarget(`/projects/${slug}`)).toBeNull();
  });

  it.each(["/projects/does-not-exist", `/projects/${projectsData[0].slug.toUpperCase()}`])(
    "rewrites the unknown project %s to an unmatched route (404)",
    (path) => {
      expect(rewriteTarget(path)).toBe(UNMATCHED_ROUTE_PATH);
    },
  );
});
