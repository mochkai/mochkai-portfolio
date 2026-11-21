import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/schemas";
import { formatDateRange } from "@/lib/format";
import { isSvgImage } from "@/lib/images";
import { TechList } from "./TechList";

/** Props for {@link ProjectList}. */
export interface ProjectListProps {
  projects: readonly Project[];
  /** Heading level for each project title, so the list fits the page outline. */
  headingLevel?: 2 | 3;
}

/**
 * Projects as a stacked list: thumbnail, title linking to the detail page, dates,
 * summary and technologies.
 */
export function ProjectList({ projects, headingLevel = 2 }: ProjectListProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  if (projects.length === 0) {
    return <p className="text-muted">No projects published yet.</p>;
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {projects.map((project) => (
        <li key={project.slug} className="grid gap-5 py-8 sm:grid-cols-[14rem_1fr] sm:gap-8">
          <Image
            src={project.image}
            alt=""
            width={448}
            height={252}
            unoptimized={isSvgImage(project.image)}
            className="aspect-video w-full rounded-sm border border-line object-cover"
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Heading className="font-display text-xl font-semibold tracking-tight">
                <Link href={`/projects/${project.slug}`} className="hover:text-accent">
                  {project.title}
                </Link>
              </Heading>
              <p className="font-mono text-xs text-muted">
                {formatDateRange(project.startDate, project.endDate)}
              </p>
            </div>
            <p className="max-w-prose leading-relaxed text-muted">{project.summary}</p>
            <TechList items={project.tech} label={`Technologies used in ${project.title}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
