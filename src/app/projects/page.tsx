import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ProjectList } from "@/components/ProjectList";
import { getRepository } from "@/lib/data";
import { toPublicProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
  description: "Projects I have designed and built.",
};

/**
 * The quest board: every project as a completed-quest card, newest first. Projects are
 * redacted with `toPublicProjects`, so no dates reach the page.
 */
export default async function ProjectsPage() {
  const projects = toPublicProjects(await getRepository().getProjects());

  return (
    <>
      <PageHeader title="Projects" label="Quest board">
        <p>Things I have designed and built, newest first.</p>
      </PageHeader>
      <ProjectList projects={projects} />
    </>
  );
}
