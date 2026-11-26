import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Collectible } from "@/components/Collectible";
import { ProjectStatusLabel } from "@/components/ProjectStatusLabel";
import { TechList } from "@/components/TechList";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { getRepository } from "@/lib/data";
import { isSvgImage } from "@/lib/images";
import { toPublicProject } from "@/lib/projects";

/** Prerenders one page per project at build time. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const projects = await getRepository().getProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

/**
 * Title, description and Open Graph data from the redacted project (no dates); empty metadata
 * when it does not exist.
 */
export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await getRepository().getProjectBySlug(slug);
  if (!found) return {};
  const project = toPublicProject(found);
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: project.title, description: project.summary, images: [project.image] },
  };
}

/**
 * Project detail page, styled as a completed quest: back link to the quest board, status label,
 * title and summary, the hero image in a rune-lined frame, the description, and an "items" panel
 * with the technologies and the repo/live links. The project is redacted with `toPublicProject`
 * before rendering, so no dates reach the page.
 *
 * Unknown slugs are answered with a 404 by Proxy (`src/proxy.ts`) before this page renders; the
 * `notFound()` below is a fallback.
 */
export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const found = await getRepository().getProjectBySlug(slug);
  // Fallback only: with Cache Components the static shell is streamed with a 200 before this
  // request-time notFound() runs, so on its own it gives the not-found UI and noindex but not
  // a 404 status. Proxy rejects unknown slugs with a real 404 before rendering; this still
  // covers requests that bypass it (e.g. if Proxy's slug list and the repository disagree).
  if (!found) notFound();

  const project = toPublicProject(found);
  const { repo, live } = project.links;

  return (
    <article aria-labelledby="project-title">
      <ButtonLink href="/projects" variant="ghost" size="sm" className="-ml-3.5">
        <span aria-hidden="true">←</span>
        All projects
      </ButtonLink>

      <header className="mt-8 max-w-3xl">
        <ProjectStatusLabel status={project.status} />
        <h1
          id="project-title"
          className="mt-4 font-display text-4xl leading-tight font-semibold tracking-tight break-words text-shadow-glow sm:text-5xl"
        >
          {project.title}
        </h1>
        <p className="mt-5 max-w-2xl text-xl leading-relaxed text-foreground">{project.summary}</p>
      </header>

      <Card className="mt-10 px-2 py-2 sm:px-3 sm:py-3">
        <Image
          src={project.image}
          alt=""
          width={1200}
          height={675}
          unoptimized={isSvgImage(project.image)}
          loading="eager"
          fetchPriority="high"
          data-testid="project-hero-image"
          className="relative aspect-video w-full rounded-lg object-cover"
        />
      </Card>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <p className="max-w-prose text-lg leading-relaxed text-muted">{project.description}</p>

        <aside aria-label="Project details" className="self-start">
          <Card className="flex flex-col gap-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label as="h2">Built with</Label>
                {/* Hidden rune shard 3: the same shard on every project page. */}
                <Collectible id="quest-loot" className="-my-1 -mr-3" />
              </div>
              <TechList items={project.tech} label={`Technologies used in ${project.title}`} />
            </div>
            {(live || repo) && (
              <div>
                <Label as="h2" className="mb-3">
                  Links
                </Label>
                <ul className="flex flex-col gap-3">
                  {live && (
                    <li>
                      <ButtonLink
                        href={live}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        Visit live site
                        <span aria-hidden="true">↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </ButtonLink>
                    </li>
                  )}
                  {repo && (
                    <li>
                      <ButtonLink
                        href={repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant={live ? "secondary" : "primary"}
                        className="w-full"
                      >
                        View source code
                        <span aria-hidden="true">↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </ButtonLink>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </article>
  );
}
