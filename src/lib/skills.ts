import type { Project, Skill, SkillGroup, SkillRank } from "@/lib/schemas";
import { toNameKey } from "@/lib/names";

/** How many of the 3 pips are lit for each rank. */
export const RANK_PIPS: Readonly<Record<SkillRank, 1 | 2 | 3>> = {
  mastered: 3,
  proficient: 2,
  learning: 1,
};

/** Total pips shown per skill. */
export const PIP_COUNT = 3;

/**
 * The display label for a rank: the lowercase data value, capitalised (`mastered` -> `Mastered`).
 *
 * @param rank - A skill rank from the data.
 * @returns The label shown next to the pips and read by screen readers.
 */
export function rankLabel(rank: SkillRank): string {
  return rank.charAt(0).toUpperCase() + rank.slice(1);
}

/**
 * Whether a project lists a technology in its `tech`, compared case-insensitively after
 * trimming. A blank name never matches.
 *
 * @param project - A project (only `tech` is read).
 * @param name - A skill or technology name.
 * @returns `true` when one of the project's technologies is that name.
 */
export function projectUsesTech(project: Pick<Project, "tech">, name: string): boolean {
  const key = toNameKey(name);
  return key !== "" && project.tech.some((tech) => toNameKey(tech) === key);
}

/**
 * The projects that use a technology ({@link projectUsesTech}), in their original order.
 *
 * @param projects - Projects to filter.
 * @param name - A skill or technology name, for example from `/projects?tech=`.
 * @returns The matching projects; empty for an unknown or blank name.
 */
export function filterProjectsByTech<T extends Pick<Project, "tech">>(
  projects: readonly T[],
  name: string,
): T[] {
  return projects.filter((project) => projectUsesTech(project, name));
}

/**
 * Counts the projects that use a skill: "Used in N quests".
 *
 * @param name - The skill name.
 * @param projects - All projects.
 * @returns How many projects list the skill in their `tech`.
 */
export function countProjectsUsingSkill(
  name: string,
  projects: readonly Pick<Project, "tech">[],
): number {
  return filterProjectsByTech(projects, name).length;
}

/** A skill with the number of projects that use it. */
export interface SkillWithUsage extends Skill {
  /** Projects whose `tech` contains the skill name. */
  questCount: number;
}

/** A skill group whose items carry their usage count. */
export interface SkillGroupWithUsage extends Omit<SkillGroup, "items"> {
  items: SkillWithUsage[];
}

/**
 * Adds "Used in N quests" counts to every skill, keeping the group and item order.
 *
 * @param skills - The profile's skill groups.
 * @param projects - All projects.
 * @returns New groups; the input is not mutated.
 */
export function getSkillUsage(
  skills: readonly SkillGroup[],
  projects: readonly Pick<Project, "tech">[],
): SkillGroupWithUsage[] {
  return skills.map((group) => ({
    category: group.category,
    items: group.items.map((skill) => ({
      ...skill,
      questCount: countProjectsUsingSkill(skill.name, projects),
    })),
  }));
}

/**
 * The usage text for a skill: `Used in 1 quest`, `Used in 3 quests`, or `No quests yet` for 0.
 *
 * @param count - Projects that use the skill.
 * @returns The text to show.
 */
export function questUsageLabel(count: number): string {
  if (count === 0) return "No quests yet";
  return `Used in ${count} ${count === 1 ? "quest" : "quests"}`;
}

/**
 * The `/projects` URL filtered to one technology.
 *
 * @param name - The skill name.
 * @returns `/projects?tech=<name, URL-encoded>`.
 */
export function techFilterHref(name: string): string {
  return `/projects?tech=${encodeURIComponent(name)}`;
}

/**
 * Reads the `tech` search param of `/projects`.
 *
 * @param value - The raw value from `searchParams` (a repeated param arrives as an array).
 * @returns `null` when the param is absent (no filter), else the first value as given; an
 *   empty string is a filter that matches nothing.
 */
export function parseTechParam(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
