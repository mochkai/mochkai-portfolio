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
