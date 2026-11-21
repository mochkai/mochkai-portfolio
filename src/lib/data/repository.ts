import type { Experience, Profile, Project } from "@/lib/schemas";

/** Filters accepted by {@link PortfolioRepository.getProjects}. */
export interface GetProjectsOptions {
  /** When set, return only projects whose `featured` flag matches. */
  featured?: boolean;
}

/**
 * Read-only access to portfolio content, independent of where it is stored.
 *
 * Pages and API routes depend only on this interface. Each adapter (local JSON today,
 * a headless CMS or a separate content API later) implements it and must validate what
 * it returns against the schemas in `@/lib/schemas`.
 */
export interface PortfolioRepository {
  /** Returns the site owner's profile. */
  getProfile(): Promise<Profile>;
  /** Returns projects, newest first, optionally filtered. */
  getProjects(options?: GetProjectsOptions): Promise<Project[]>;
  /** Returns one project, or `null` when no project has that slug. */
  getProjectBySlug(slug: string): Promise<Project | null>;
  /** Returns work experience, most recent first. */
  getExperience(): Promise<Experience[]>;
}

/** Sorts items by `startDate` (YYYY-MM), newest first, without mutating the input. */
export function sortByStartDateDesc<T extends { startDate: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * Recursively freezes `value` in place and returns it, so memoized content shared across
 * requests cannot be changed by callers. Mutation then throws in strict-mode code.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
