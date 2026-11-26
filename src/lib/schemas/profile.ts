import { z } from "zod";
import { toNameKey } from "@/lib/names";
import { httpUrlSchema, imageSrcSchema } from "./common";

/** A link to an external profile (GitHub, LinkedIn, ...). */
export const socialLinkSchema = z.object({
  label: z.string().min(1),
  url: httpUrlSchema,
});

/**
 * Owner-set skill ranks, from strongest to weakest. Shown as 3, 2 or 1 lit pips plus a text
 * label; never as a percentage, numeric level or years-per-skill (DESIGN.md "Content and privacy").
 */
export const SKILL_RANKS = ["mastered", "proficient", "learning"] as const;

/** A skill rank: `mastered`, `proficient` or `learning` (lowercase in data). */
export const skillRankSchema = z.enum(SKILL_RANKS);

/** One skill and its owner-set rank, e.g. `{ "name": "React", "rank": "mastered" }`. */
export const skillSchema = z.object({
  // Must contain a visible character; also matched against project `tech` after trimming.
  name: z.string().regex(/\S/, "Skill name must not be empty"),
  rank: skillRankSchema,
});

/** A named group of related skills, e.g. "Frontend", with at least one skill. */
export const skillGroupSchema = z.object({
  category: z.string().regex(/\S/, "Skill category must not be empty"),
  items: z.array(skillSchema).min(1),
});

/**
 * Every skill group. Skill names must be unique across the whole list, compared
 * case-insensitively after trimming, because each name is also a `/projects?tech=` filter.
 */
export const skillListSchema = z.array(skillGroupSchema).superRefine((groups, ctx) => {
  const seen = new Set<string>();
  groups.forEach((group, groupIndex) => {
    group.items.forEach((skill, itemIndex) => {
      const key = toNameKey(skill.name);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate skill name "${skill.name}"`,
          path: [groupIndex, "items", itemIndex, "name"],
        });
      }
      seen.add(key);
    });
  });
});

/** The site owner's profile. */
export const profileSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  bio: z.string().min(1),
  location: z.string().min(1),
  avatar: imageSrcSchema,
  // Rendered as a `mailto:` link; z.email() only allows a plain address, so no scheme injection.
  email: z.email().optional(),
  socials: z.array(socialLinkSchema),
  skills: skillListSchema,
  /** Scoreboard "Class", e.g. `Full-stack · Backend main`. Falls back to `title` when unset. */
  characterClass: z.string().min(1).optional(),
  /** Scoreboard "Currently learning", e.g. `["LangGraph"]`. The tile is hidden when unset. */
  currentlyLearning: z.array(z.string().min(1)).optional(),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SkillRank = z.infer<typeof skillRankSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Profile = z.infer<typeof profileSchema>;
