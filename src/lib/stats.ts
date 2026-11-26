import type { Experience, Profile, Project } from "@/lib/schemas";

/**
 * One scoreboard value for the home and About pages. Every value is computed from or stated in
 * the content data; none is date-derived (see the "no age signals" rule in DESIGN.md).
 */
export interface HomeStat {
  /** Stable identifier, also used as the React key. */
  id: "quests" | "skills" | "class" | "learning";
  /** HUD label shown above the value, in normal case. */
  label: string;
  /** The value to show. */
  value: string | number;
  /** `count` values are numbers; `text` values are short phrases and render smaller. */
  kind: "count" | "text";
}

/** Inputs for {@link getHomeStats}. */
export interface HomeStatsInput {
  profile: Pick<Profile, "title" | "characterClass" | "currentlyLearning">;
  projects: readonly Pick<Project, "tech">[];
}

/**
 * Counts distinct, non-empty strings, compared case-insensitively after trimming.
 *
 * @param values - Strings to count, e.g. technology or company names.
 * @returns The number of distinct values.
 */
function countDistinct(values: Iterable<string>): number {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen.size;
}

/**
 * Counts the distinct technologies across every project's `tech` list ("Skills unlocked").
 * `"React"` and `" react "` count once.
 *
 * @param projects - All projects.
 * @returns The number of distinct technologies.
 */
export function countDistinctTechnologies(projects: readonly Pick<Project, "tech">[]): number {
  return countDistinct(projects.flatMap((project) => project.tech));
}

/**
 * Counts the distinct companies in the experience list, compared case-insensitively after
 * trimming. Not shown on the home page; kept for the About page.
 *
 * @param experience - All experience entries.
 * @returns The number of distinct companies.
 */
export function countDistinctCompanies(experience: readonly Pick<Experience, "company">[]): number {
  return countDistinct(experience.map((entry) => entry.company));
}

/**
 * The character class shown on the scoreboard: `profile.characterClass`, falling back to
 * `profile.title` when it is not set.
 *
 * @param profile - The site owner's profile.
 * @returns The class text.
 */
export function getCharacterClass(profile: Pick<Profile, "title" | "characterClass">): string {
  return profile.characterClass ?? profile.title;
}

/**
 * What the owner is currently learning, joined with ` · `.
 *
 * @param profile - The site owner's profile.
 * @returns The joined text, or `null` when the field is missing or empty (the tile is hidden).
 */
export function getCurrentlyLearning(profile: Pick<Profile, "currentlyLearning">): string | null {
  const items = (profile.currentlyLearning ?? []).map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.join(" · ") : null;
}

/**
 * Builds the home page scoreboard, in display order: Quests completed (project count), Skills
 * unlocked (distinct project technologies), Class and, when set, Currently learning.
 *
 * @param input - Profile and all projects.
 * @returns The stats to render.
 */
export function getHomeStats({ profile, projects }: HomeStatsInput): HomeStat[] {
  const stats: HomeStat[] = [
    { id: "quests", label: "Quests completed", value: projects.length, kind: "count" },
    {
      id: "skills",
      label: "Skills unlocked",
      value: countDistinctTechnologies(projects),
      kind: "count",
    },
    { id: "class", label: "Class", value: getCharacterClass(profile), kind: "text" },
  ];
  const learning = getCurrentlyLearning(profile);
  if (learning) {
    stats.push({ id: "learning", label: "Currently learning", value: learning, kind: "text" });
  }
  return stats;
}
