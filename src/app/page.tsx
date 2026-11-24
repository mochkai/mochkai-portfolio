import Image from "next/image";
import Link from "next/link";
import { ProjectList } from "@/components/ProjectList";
import { getRepository } from "@/lib/data";
import { isSvgImage } from "@/lib/images";

/** Home page: introduction from the profile and featured projects. */
export default async function HomePage() {
  const repository = getRepository();
  const [profile, featured] = await Promise.all([
    repository.getProfile(),
    repository.getProjects({ featured: true }),
  ]);

  return (
    <>
      <section
        aria-labelledby="intro-heading"
        className="flex flex-col gap-8 sm:flex-row sm:items-start"
      >
        <Image
          src={profile.avatar}
          alt={`Portrait of ${profile.name}`}
          width={112}
          height={112}
          unoptimized={isSvgImage(profile.avatar)}
          loading="eager"
          fetchPriority="high"
          className="size-24 shrink-0 rounded-full border border-line sm:size-28"
        />
        <div className="max-w-2xl">
          <h1
            id="intro-heading"
            className="font-display text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl"
          >
            {profile.name}
          </h1>
          <p className="mt-3 text-xl text-foreground">
            {profile.title} <span className="text-muted">in {profile.location}</span>
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted">{profile.bio}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/projects"
              className="rounded-sm bg-accent px-4 py-2 font-medium text-accent-foreground hover:opacity-90"
            >
              See all projects
            </Link>
            <Link
              href="/experience"
              className="rounded-sm border border-line px-4 py-2 font-medium hover:border-foreground"
            >
              Read experience
            </Link>
            <Link
              href="/about"
              className="rounded-sm px-4 py-2 font-medium text-muted hover:text-foreground"
            >
              About me
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="mt-20">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 id="featured-heading" className="font-display text-2xl font-semibold tracking-tight">
            Featured projects
          </h2>
          <Link href="/projects" className="text-sm text-accent hover:underline">
            All projects
          </Link>
        </div>
        <ProjectList projects={featured} headingLevel={3} />
      </section>
    </>
  );
}
