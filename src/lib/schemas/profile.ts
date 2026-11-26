import { z } from "zod";
import { httpUrlSchema, imageSrcSchema } from "./common";

/** A link to an external profile (GitHub, LinkedIn, ...). */
export const socialLinkSchema = z.object({
  label: z.string().min(1),
  url: httpUrlSchema,
});

/** A named group of related skills, e.g. "Frontend". */
export const skillGroupSchema = z.object({
  category: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
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
  skills: z.array(skillGroupSchema),
  /** Scoreboard "Class", e.g. `Full-stack · Backend main`. Falls back to `title` when unset. */
  characterClass: z.string().min(1).optional(),
  /** Scoreboard "Currently learning", e.g. `["LangGraph"]`. The tile is hidden when unset. */
  currentlyLearning: z.array(z.string().min(1)).optional(),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Profile = z.infer<typeof profileSchema>;
