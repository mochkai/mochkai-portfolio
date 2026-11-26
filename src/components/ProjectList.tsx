import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { isSvgImage } from "@/lib/images";
import type { PublicProject } from "@/lib/projects";
import { ProjectStatusLabel } from "./ProjectStatusLabel";
import { TechList } from "./TechList";
import { TiltCard } from "./TiltCard";

/** Props for {@link ProjectList}. */
export interface ProjectListProps {
  /**
   * Projects to show, already redacted with `toPublicProjects`, so no dates can be rendered
   * (DESIGN.md "Content and privacy").
   */
  projects: readonly PublicProject[];
  /** Heading level for each project title, so the list fits the page outline. */
  headingLevel?: 2 | 3;
}

/**
 * Projects as a grid of "completed quest" cards: 1 column on phones, 2 from 640 px, 3 from
 * 1024 px. Each card shows a decorative image, a status label, the title, summary and
 * technologies.
 *
 * The title link is stretched over the whole card (an `::after` overlay), so the card is one
 * link with no nested links; keyboard focus draws the focus ring around the card and lights the
 * same glow as hover. The card content is server-rendered; only the pointer tilt (`TiltCard`)
 * runs on the client.
 */
export function ProjectList({ projects, headingLevel = 2 }: ProjectListProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  if (projects.length === 0) {
    return <p className="text-muted">No projects published yet.</p>;
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.slug}>
          <TiltCard>
            <Card
              as="article"
              interactive
              className="group flex h-full flex-col gap-4 px-5 py-5 sm:px-5 sm:py-5"
              data-testid="project-card"
            >
              <Image
                src={project.image}
                alt=""
                width={640}
                height={360}
                unoptimized={isSvgImage(project.image)}
                className="aspect-video w-full rounded-md border border-line object-cover"
              />
              <ProjectStatusLabel status={project.status} />
              <Heading className="-mt-1 font-display text-xl leading-snug font-semibold tracking-tight">
                <Link
                  href={`/projects/${project.slug}`}
                  className={
                    "group-hover:text-glow motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out " +
                    "after:absolute after:inset-0 after:z-10 after:rounded-xl after:content-[''] " +
                    "focus-visible:outline-none focus-visible:after:outline-2 " +
                    "focus-visible:after:outline-offset-3 focus-visible:after:outline-neon " +
                    "focus-visible:after:outline-solid motion-reduce:transition-none"
                  }
                >
                  {project.title}
                </Link>
              </Heading>
              <p className="leading-relaxed text-muted">{project.summary}</p>
              <div className="mt-auto pt-2">
                <TechList items={project.tech} label={`Technologies used in ${project.title}`} />
              </div>
            </Card>
          </TiltCard>
        </li>
      ))}
    </ul>
  );
}
