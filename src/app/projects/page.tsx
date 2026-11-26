import type { Metadata } from "next";
import { Suspense } from "react";
import { Collectible } from "@/components/Collectible";
import { PageHeader } from "@/components/PageHeader";
import { ProjectList } from "@/components/ProjectList";
import { QuestFilter } from "@/components/QuestFilter";
import { getRepository } from "@/lib/data";
import { toPublicProjects } from "@/lib/projects";
import { parseTechParam } from "@/lib/skills";

export const metadata: Metadata = {
  title: "Projects",
  description: "Projects I have designed and built.",
};

/**
 * The quest list for the current URL: every project, or with `?tech=<name>` only the projects
 * that use that technology (via {@link QuestFilter}). Projects are redacted with
 * `toPublicProjects`, so no dates reach the page.
 *
 * @param searchParams - The page's `searchParams` promise (request-time data).
 * @returns The list to render inside the page's Suspense boundary.
 */
async function renderQuests(searchParams: PageProps<"/projects">["searchParams"]) {
  const [{ tech }, projects] = await Promise.all([searchParams, getRepository().getProjects()]);
  const filter = parseTechParam(tech);
  const publicProjects = toPublicProjects(projects);
  if (filter === null) return <ProjectList projects={publicProjects} />;
  return <QuestFilter projects={publicProjects} tech={filter} />;
}

/**
 * The quest board: every project as a completed-quest card, newest first. `?tech=<name>` narrows
 * it to the projects whose technologies include that name (case-insensitive, trimmed), which is
 * where the About page's skill links point.
 *
 * `searchParams` is read inside a Suspense boundary, so the header stays in the static shell
 * (Cache Components) and only the list renders at request time.
 */
export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <>
      <PageHeader
        title="Projects"
        label="Quest board"
        collectible={<Collectible id="quest-board" />}
      >
        <p>Things I have designed and built, newest first.</p>
      </PageHeader>
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Loading quests…
          </p>
        }
      >
        {renderQuests(searchParams)}
      </Suspense>
    </>
  );
}
