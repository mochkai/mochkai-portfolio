import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ProjectList } from "@/components/ProjectList";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = {
  title: "Projects",
  description: "Projects I have designed and built.",
};

/** Lists every project, newest first. */
export default async function ProjectsPage() {
  const projects = await getRepository().getProjects();

  return (
    <>
      <PageHeader title="Projects">
        <p>Things I have designed and built, newest first.</p>
      </PageHeader>
      <ProjectList projects={projects} />
    </>
  );
}
