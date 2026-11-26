import Link from "next/link";
import type { PublicProject } from "@/lib/projects";
import { filterProjectsByTech } from "@/lib/skills";
import { toNameKey } from "@/lib/names";
import { ProjectList } from "./ProjectList";

/** Props for {@link QuestFilter}. */
export interface QuestFilterProps {
  /** All projects, already redacted with `toPublicProjects`. */
  projects: readonly PublicProject[];
  /** The `?tech=` value as given in the URL (may be empty or unknown). */
  tech: string;
}

/**
 * The `/projects?tech=<name>` view: a filter bar ("Quests using React" and a "Show all quests"
 * link back to `/projects`) over the projects whose `tech` includes that name (case-insensitive,
 * trimmed). The heading uses the technology as written in the project data, never the raw query
 * value; an unknown or empty value shows a generic empty state, so arbitrary URL text is never
 * echoed into the page.
 */
export function QuestFilter({ projects, tech }: QuestFilterProps) {
  const matches = filterProjectsByTech(projects, tech);
  const key = toNameKey(tech);
  // The spelling from the content data, e.g. "Next.js" for `?tech=next.JS`.
  const name = matches[0]?.tech.find((item) => toNameKey(item) === key);

  return (
    <section aria-labelledby="quest-filter-heading" data-testid="quest-filter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-dashed border-line py-4">
        <h2
          id="quest-filter-heading"
          className="font-display text-xl font-semibold tracking-tight break-words"
        >
          {name ? `Quests using ${name}` : "No matching quests"}
        </h2>
        <Link href="/projects" className="text-sm text-accent underline-offset-4 hover:underline">
          Show all quests
        </Link>
      </div>
      {matches.length > 0 ? (
        <ProjectList projects={matches} headingLevel={3} />
      ) : (
        <p className="text-muted">No quests use that technology yet.</p>
      )}
    </section>
  );
}
