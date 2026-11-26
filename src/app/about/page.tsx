import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { SkillTree } from "@/components/SkillTree";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { StatGrid } from "@/components/ui/StatGrid";
import { StatTile } from "@/components/ui/StatTile";
import { cx } from "@/lib/cx";
import { getRepository } from "@/lib/data";
import { isSvgImage } from "@/lib/images";
import { getSkillUsage } from "@/lib/skills";
import { getAboutStats, getCharacterClass } from "@/lib/stats";

export const metadata: Metadata = {
  title: "About",
  description: "Background, skills and how to get in touch.",
};

/** Shared style for the section headings in the main column. */
const SECTION_HEADING = "mb-5 font-display text-2xl font-semibold tracking-tight";

/**
 * The About page as a character sheet. Two columns from 1024 px, stacked below:
 *
 * - Sidebar: the identity panel (portrait, name, title, `Class` and `Region` HUD labels and the
 *   character stats from `getAboutStats`, the same tiles as the home scoreboard plus Guilds
 *   joined), then the contact links.
 * - Main column: the bio as "Backstory" and the skill tree, where each skill shows its owner-set
 *   rank and how many projects use it, linking to `/projects?tech=<name>`.
 *
 * Every value comes from the content data. Nothing is date-derived: no years, no ages, no
 * percentages (DESIGN.md "Content and privacy").
 */
export default async function AboutPage() {
  const repository = getRepository();
  const [profile, projects, experience] = await Promise.all([
    repository.getProfile(),
    repository.getProjects(),
    repository.getExperience(),
  ]);
  const stats = getAboutStats({ profile, projects, experience });
  const skills = getSkillUsage(profile.skills, projects);

  return (
    <>
      <PageHeader title="About" label="Character sheet" />

      <div className="grid gap-10 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card
            as="section"
            aria-labelledby="identity-heading"
            data-testid="identity-panel"
            className="bg-radial-[at_20%_0%] from-accent-soft to-surface to-70% px-5 py-6 sm:px-6"
          >
            <div className="relative flex items-center gap-4">
              <Image
                src={profile.avatar}
                alt={`Portrait of ${profile.name}`}
                width={96}
                height={96}
                unoptimized={isSvgImage(profile.avatar)}
                className="size-20 shrink-0 rounded-lg border border-neon/40 bg-background object-cover shadow-glow-sm"
              />
              <div className="min-w-0">
                <h2
                  id="identity-heading"
                  className="font-display text-2xl leading-tight font-semibold tracking-tight break-words"
                >
                  {profile.name}
                </h2>
                <p className="mt-1 text-muted">{profile.title}</p>
              </div>
            </div>
            <div className="relative mt-5 flex flex-col items-start gap-2">
              <Label as="p" rune>
                Class · {getCharacterClass(profile)}
              </Label>
              <Label as="p" rune>
                Region · {profile.location}
              </Label>
            </div>
            <StatGrid
              label="Character stats"
              className="relative mt-6 max-sm:grid-cols-2 sm:grid-cols-3"
            >
              {stats.map((stat) => (
                <StatTile
                  key={stat.id}
                  label={stat.label}
                  className={cx(stat.kind === "text" && "col-span-full")}
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

          <Card as="section" aria-labelledby="contact-heading" className="px-5 py-6 sm:px-6">
            <h2
              id="contact-heading"
              className="mb-4 font-display text-xl font-semibold tracking-tight"
            >
              Get in touch
            </h2>
            <ul className="flex flex-col gap-2">
              {profile.email && (
                <li>
                  <a
                    href={`mailto:${profile.email}`}
                    className="break-all text-accent underline-offset-4 hover:underline"
                  >
                    {profile.email}
                  </a>
                </li>
              )}
              {profile.socials.map((social) => (
                <li key={social.url}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-14">
          <section aria-labelledby="backstory-heading">
            <h2 id="backstory-heading" className={SECTION_HEADING}>
              Backstory
            </h2>
            <p className="max-w-prose text-lg leading-relaxed text-muted">{profile.bio}</p>
          </section>

          <section aria-labelledby="skills-heading">
            <h2 id="skills-heading" className={SECTION_HEADING}>
              Skills
            </h2>
            <SkillTree groups={skills} />
          </section>
        </div>
      </div>
    </>
  );
}
