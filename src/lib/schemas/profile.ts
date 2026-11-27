import { z } from "zod";
import { findSkillTreeIssues } from "@/lib/skill-tree";
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

/** A skill or branch id: a lowercase slug such as `nextjs` or `ci-cd`. */
const skillIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Skill ids are lowercase slugs, e.g. ci-cd");

/**
 * One skill in the tree, e.g.
 * `{ "id": "react", "name": "React", "rank": "mastered", "requires": ["typescript"] }`.
 * `requires` lists prerequisite skill ids in the same branch; when it is missing or empty the
 * skill hangs directly off the branch root.
 */
export const skillSchema = z.object({
  id: skillIdSchema,
  // Must contain a visible character; also matched against project `tech` after trimming.
  name: z.string().regex(/\S/, "Skill name must not be empty"),
  rank: skillRankSchema,
  requires: z.array(skillIdSchema).optional(),
});

/** One branch of the tree (Front end, Back end, ...) with at least one skill. */
export const skillBranchSchema = z.object({
  id: skillIdSchema,
  name: z.string().regex(/\S/, "Skill branch name must not be empty"),
  skills: z.array(skillSchema).min(1),
});

/**
 * The whole skill tree. Besides the shape, it rejects (and so fails the build on) duplicate
 * branch or skill ids, duplicate skill names (compared case-insensitively after trimming,
 * because each name is also a `/projects?tech=` filter), a `requires` that points to an unknown
 * id, to itself or to a skill in another branch, and cycles. See {@link findSkillTreeIssues}.
 */
export const skillTreeSchema = z
  .array(skillBranchSchema)
  .min(1)
  .superRefine((tree, ctx) => {
    for (const issue of findSkillTreeIssues(tree)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
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
  skillTree: skillTreeSchema,
  /** Scoreboard "Class", e.g. `Full-stack · Backend main`. Falls back to `title` when unset. */
  characterClass: z.string().min(1).optional(),
  /** Scoreboard "Currently learning", e.g. `["LangGraph"]`. The tile is hidden when unset. */
  currentlyLearning: z.array(z.string().min(1)).optional(),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SkillRank = z.infer<typeof skillRankSchema>;
export type Profile = z.infer<typeof profileSchema>;
