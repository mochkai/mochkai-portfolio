import Image from "next/image";
import Link from "next/link";
import { JoinTheParty } from "@/components/JoinTheParty";
import { ProjectList } from "@/components/ProjectList";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { StatGrid } from "@/components/ui/StatGrid";
import { StatTile } from "@/components/ui/StatTile";
import { getRepository } from "@/lib/data";
import { isSvgImage } from "@/lib/images";
import { toPublicProjects } from "@/lib/projects";
import { getHomeStats } from "@/lib/stats";

/** The mochkai logo, which "boots up" in the hero. */
const LOGO_SRC = "/images/logo.svg";

/**
 * Home page as a title screen: the logo powers on, a `Player 1` HUD label, the owner's name,
 * title and bio, a glowing "Press Start" CTA to the projects, secondary CTAs, and a scoreboard
 * computed from the content data. Featured projects follow below as completed-quest cards,
 * redacted with `toPublicProjects` so no project dates reach the page, then the compact
 * "Join the party" contact band.
 *
 * Every animation here is CSS only and starts from a visible state, so the hero is fully readable
 * without JavaScript and before the animations finish. Both are off under reduced motion.
 */
export default async function HomePage() {
  const repository = getRepository();
  const [profile, projects, featured] = await Promise.all([
    repository.getProfile(),
    repository.getProjects(),
    repository.getProjects({ featured: true }),
  ]);
  const stats = getHomeStats({ profile, projects });

  return (
    <>
      <Card
        as="section"
        aria-labelledby="intro-heading"
        className="bg-radial-[at_15%_0%] from-accent-soft to-surface to-60% px-5 py-8 sm:px-10 sm:py-12"
      >
        <div className="relative grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10">
          <Image
            src={LOGO_SRC}
            alt=""
            width={224}
            height={224}
            unoptimized={isSvgImage(LOGO_SRC)}
            loading="eager"
            fetchPriority="high"
            data-testid="hero-logo"
            className="size-20 animate-boot drop-shadow-glow motion-reduce:animate-none sm:order-last sm:size-40 lg:size-56"
          />
          <div className="min-w-0">
            <Label as="p" rune>
              Player 1 · {profile.title}
            </Label>
            <h1
              id="intro-heading"
              className="mt-4 font-display text-5xl leading-[1.05] font-bold tracking-tight break-words text-shadow-glow sm:text-6xl"
            >
              {profile.name}
            </h1>
            <p className="mt-3 text-xl text-foreground">
              {profile.title} <span className="text-muted">in {profile.location}</span>
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{profile.bio}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/projects"
                aria-label="Press Start: view projects"
                data-testid="press-start"
                className="animate-cta-pulse hover:animate-none motion-reduce:animate-none"
              >
                <span aria-hidden="true" className="text-xs text-glow">
                  ▶
                </span>
                Press Start
                <span className="font-mono text-xs font-normal text-glow">View projects</span>
              </ButtonLink>
              <ButtonLink href="/experience" variant="secondary">
                Read experience
              </ButtonLink>
              <ButtonLink href="/about" variant="ghost">
                About me
              </ButtonLink>
            </div>
          </div>
        </div>

        <StatGrid label="Player stats" className="relative mt-10">
          {stats.map((stat) => (
            <StatTile
              key={stat.id}
              label={stat.label}
              value={
                stat.kind === "text" ? (
                  <span className="block text-xl leading-snug">{stat.value}</span>
                ) : (
                  <span className="tabular-nums">{stat.value}</span>
                )
              }
            />
          ))}
        </StatGrid>
      </Card>

      <section aria-labelledby="featured-heading" className="mt-20">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 id="featured-heading" className="font-display text-2xl font-semibold tracking-tight">
            Featured projects
          </h2>
          <Link href="/projects" className="text-sm text-accent hover:underline">
            All projects
          </Link>
        </div>
        <ProjectList projects={toPublicProjects(featured)} headingLevel={3} />
      </section>

      <JoinTheParty
        email={profile.email}
        socials={profile.socials}
        variant="band"
        className="mt-20"
      />
    </>
  );
}
