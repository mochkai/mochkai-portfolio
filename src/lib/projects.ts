import type { Project } from "@/lib/schemas";

/**
 * Whether a project is finished (`complete`) or still being worked on (`active`).
 * Derived from `endDate` before the dates are removed; it carries no date, range or duration.
 */
export type ProjectStatus = "complete" | "active";

/**
 * A project as it may leave the server: every field except `startDate` and `endDate`
 * (DESIGN.md "Content and privacy": no dates anywhere), plus its {@link ProjectStatus}.
 */
export type PublicProject = Omit<Project, "startDate" | "endDate"> & { status: ProjectStatus };

/**
 * Redacts one project for public output (pages, API responses, metadata). The date keys are
 * omitted entirely, not set to `null` or an empty string. The input is not mutated (the nested
 * `tech` and `links` values are shared, not copied; repository data is deep-frozen).
 *
 * The repository keeps returning full projects so it can still order them by date; every
 * output boundary must go through this function (or {@link toPublicProjects}).
 *
 * @param project - A full project from the repository.
 * @returns The project without `startDate`/`endDate`, with `status` set.
 */
export function toPublicProject(project: Project): PublicProject {
  // An allowlist rather than "everything but the dates": a field added to the schema later fails
  // the type check here until it is deliberately listed, so nothing new leaks by default.
  const { slug, title, summary, description, tech, links, featured, image } = project;
  return {
    slug,
    title,
    summary,
    description,
    tech,
    links,
    featured,
    image,
    status: project.endDate === null ? "active" : "complete",
  };
}

/**
 * Redacts a list of projects with {@link toPublicProject}, keeping the input order (the
 * repository's newest-first order).
 *
 * @param projects - Full projects from the repository.
 * @returns The redacted projects, in the same order.
 */
export function toPublicProjects(projects: readonly Project[]): PublicProject[] {
  return projects.map(toPublicProject);
}
