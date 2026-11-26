import type { Experience, Profile, Project } from "@/lib/schemas";

/**
 * Builds a valid {@link Project}, with any field overridden.
 * @param overrides Fields to replace on the default project.
 * @returns A project that passes `projectSchema` unless the overrides make it invalid.
 */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    slug: "fixture-project",
    title: "Fixture Project",
    summary: "A fixture project summary.",
    description: "A fixture project description.",
    tech: ["TypeScript", "React"],
    links: { repo: "https://github.com/example/fixture", live: "https://fixture.example.com" },
    featured: false,
    image: "/images/projects/fixture.svg",
    startDate: "2024-01",
    endDate: "2024-06",
    ...overrides,
  };
}

/**
 * Builds a valid {@link Experience} entry, with any field overridden.
 * @param overrides Fields to replace on the default entry.
 * @returns An entry that passes `experienceSchema` unless the overrides make it invalid.
 */
export function makeExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: "fixture-co",
    company: "Fixture Co",
    role: "Engineer",
    location: "Remote",
    startDate: "2022-01",
    endDate: null,
    highlights: ["Shipped a fixture."],
    tech: ["Go"],
    ...overrides,
  };
}

/**
 * Builds a valid {@link Profile}, with any field overridden.
 * @param overrides Fields to replace on the default profile.
 * @returns A profile that passes `profileSchema` unless the overrides make it invalid.
 */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "Ada Fixture",
    title: "Software Engineer",
    bio: "Builds fixtures for tests.",
    location: "Testville",
    avatar: "/images/avatar.svg",
    email: "ada@example.com",
    socials: [
      { label: "GitHub", url: "https://github.com/ada" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/ada" },
    ],
    skills: [{ category: "Languages", items: ["TypeScript"] }],
    characterClass: "Full-stack · Backend main",
    currentlyLearning: ["LangGraph"],
    ...overrides,
  };
}

/**
 * Three projects with distinct start dates, deliberately out of order:
 * `beta` (2023-05, featured), `alpha` (2025-02, featured), `gamma` (2024-08, not featured).
 * Sorted newest first they read alpha, gamma, beta.
 */
export const projectFixtures: Project[] = [
  makeProject({ slug: "beta", title: "Beta", featured: true, startDate: "2023-05" }),
  makeProject({
    slug: "alpha",
    title: "Alpha",
    featured: true,
    startDate: "2025-02",
    endDate: "2025-09",
  }),
  makeProject({
    slug: "gamma",
    title: "Gamma",
    featured: false,
    startDate: "2024-08",
    endDate: null,
  }),
];

/**
 * Eight roles at six companies, newest first (the repository's order), for the experience
 * redaction tests:
 *
 * 1. `nova-staff` Nova Labs, ongoing (`endDate: null`)
 * 2. `nova-senior` Nova Labs
 * 3. `orbit` Orbit Systems
 * 4. `pixel` Pixel Forge
 * 5. `quanta` Quanta Data
 * 6. `nova-intern` `" Nova Labs "` (padded: the same company after trimming, an older role)
 * 7. `relay` Relay Works
 * 8. `summit` Summit Apps
 *
 * With a limit of 4 the dated companies are Nova Labs, Orbit Systems, Pixel Forge and Quanta
 * Data, so entries 1 to 6 are dated and 7 and 8 are not. With a limit of 0 none is dated.
 * Every month is unique so a test can look for each one.
 */
export const experienceFixtures: Experience[] = [
  makeExperience({
    id: "nova-staff",
    company: "Nova Labs",
    role: "Staff Engineer",
    startDate: "2024-03",
    endDate: null,
    highlights: ["Led the platform rewrite."],
    tech: ["TypeScript", "Next.js"],
  }),
  makeExperience({
    id: "nova-senior",
    company: "Nova Labs",
    role: "Senior Engineer",
    startDate: "2022-05",
    endDate: "2024-02",
    highlights: ["Shipped the billing service."],
    tech: ["Go"],
  }),
  makeExperience({
    id: "orbit",
    company: "Orbit Systems",
    role: "Software Engineer",
    location: "Lisbon, Portugal",
    startDate: "2020-01",
    endDate: "2022-04",
    highlights: ["Built the telemetry pipeline."],
    tech: ["Python", "Kafka"],
  }),
  makeExperience({
    id: "pixel",
    company: "Pixel Forge",
    role: "Frontend Engineer",
    startDate: "2018-06",
    endDate: "2019-11",
    highlights: ["Designed the component library."],
    tech: ["React"],
  }),
  makeExperience({
    id: "quanta",
    company: "Quanta Data",
    role: "Data Engineer",
    startDate: "2016-02",
    endDate: "2018-04",
    highlights: ["Moved reporting to a warehouse."],
    tech: ["SQL"],
  }),
  makeExperience({
    id: "nova-intern",
    company: " Nova Labs ",
    role: "Engineering Intern",
    startDate: "2015-07",
    endDate: "2015-10",
    highlights: ["Wrote internal tooling."],
    tech: ["Bash"],
  }),
  makeExperience({
    id: "relay",
    company: "Relay Works",
    role: "Junior Developer",
    location: "Porto, Portugal",
    startDate: "2013-01",
    endDate: "2015-05",
    highlights: ["Maintained the order system."],
    tech: ["PHP"],
  }),
  makeExperience({
    id: "summit",
    company: "Summit Apps",
    role: "Web Developer",
    startDate: "2011-03",
    endDate: "2012-09",
    highlights: ["Built client websites."],
    tech: ["JavaScript"],
  }),
];

/** Ids of the {@link experienceFixtures} entries that stay dated with a limit of 4. */
export const DATED_AT_FOUR = [
  "nova-staff",
  "nova-senior",
  "orbit",
  "pixel",
  "quanta",
  "nova-intern",
];
