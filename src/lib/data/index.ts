import "server-only";
import { getServerConfig } from "@/lib/config/server";
import { JsonRepository } from "./json-repository";
import type { PortfolioRepository } from "./repository";

export type { GetProjectsOptions, PortfolioRepository } from "./repository";

let repository: PortfolioRepository | undefined;

/**
 * Returns the repository for the configured `DATA_SOURCE` (one instance per process).
 *
 * To add a source: create `src/lib/data/<name>-repository.ts` implementing
 * `PortfolioRepository`, add `<name>` to `DATA_SOURCES` in `@/lib/config/server`,
 * and add one case below.
 *
 * Caching: pages are statically generated from this data at build time. A remote adapter
 * should cache its reads, e.g. mark its methods with `"use cache"` plus `cacheLife()` /
 * `cacheTag()` from `next/cache`, or pass `next: { revalidate }` to `fetch`, so pages
 * stay prerendered and refresh on a schedule or on a CMS webhook.
 */
export function getRepository(): PortfolioRepository {
  if (repository) return repository;

  const { DATA_SOURCE } = getServerConfig();
  switch (DATA_SOURCE) {
    case "json":
      repository = new JsonRepository();
      break;
    // case "cms": repository = new CmsRepository(...); break;
    default: {
      // Compile-time guard: fails type checking if a DATA_SOURCES value has no case.
      const unhandled: never = DATA_SOURCE;
      throw new Error(`Unsupported DATA_SOURCE: ${String(unhandled)}`);
    }
  }
  return repository;
}
