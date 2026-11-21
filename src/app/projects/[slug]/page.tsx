import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TechList } from "@/components/TechList";
import { getRepository } from "@/lib/data";
import { formatDateRange } from "@/lib/format";
import { isSvgImage } from "@/lib/images";

/** Prerenders one page per project at build time. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const projects = await getRepository().getProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

/** Title and description from the project; empty metadata when it does not exist. */
export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getRepository().getProjectBySlug(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: project.title, description: project.summary, images: [project.image] },
  };
}

/**
 * Project detail page. Unknown slugs render the not-found page with a `noindex` robots tag
 * (the HTTP status stays 200; see the note below).
 */
export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = await getRepository().getProjectBySlug(slug);
  // Known limitation: with Cache Components the static shell is streamed with a 200 before
  // this request-time notFound() runs, so unknown slugs get the not-found UI and noindex but
  // not a 404 status. Fix later with a slug check in Proxy that returns 404 before rendering.
  if (!project) notFound();

  const { repo, live } = project.links;

  return (
    <article className="max-w-3xl">
      <p className="mb-6 text-sm">
        <Link href="/projects" className="text-muted hover:text-foreground">
          ← All projects
        </Link>
      </p>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {project.title}
      </h1>
      <p className="mt-3 font-mono text-sm text-muted">
        {formatDateRange(project.startDate, project.endDate)}
      </p>
      <p className="mt-6 text-xl leading-relaxed">{project.summary}</p>

      <Image
        src={project.image}
        alt=""
        width={1200}
        height={675}
        unoptimized={isSvgImage(project.image)}
        priority
        className="mt-10 aspect-video w-full rounded-sm border border-line object-cover"
      />

      <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_14rem]">
        <p className="max-w-prose text-lg leading-relaxed text-muted">{project.description}</p>
        <aside className="flex flex-col gap-6 text-sm">
          <div>
            <h2 className="mb-2 font-medium">Built with</h2>
            <TechList items={project.tech} label={`Technologies used in ${project.title}`} />
          </div>
          {(repo || live) && (
            <div>
              <h2 className="mb-2 font-medium">Links</h2>
              <ul className="flex flex-col gap-1">
                {live && (
                  <li>
                    <a
                      href={live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Visit live site
                    </a>
                  </li>
                )}
                {repo && (
                  <li>
                    <a
                      href={repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      View source code
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
