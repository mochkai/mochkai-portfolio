import { z } from "zod";
import {
  dateRangeRefinement,
  httpUrlSchema,
  imageSrcSchema,
  isValidDateRange,
  slugSchema,
  yearMonthSchema,
} from "./common";

/** External links for a project. Both are optional. */
export const projectLinksSchema = z.object({
  repo: httpUrlSchema.optional(),
  live: httpUrlSchema.optional(),
});

/**
 * A portfolio project. `endDate: null` means the project is ongoing; otherwise it must
 * not be before `startDate`.
 */
export const projectSchema = z
  .object({
    slug: slugSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().min(1),
    tech: z.array(z.string().min(1)),
    links: projectLinksSchema,
    featured: z.boolean(),
    image: imageSrcSchema,
    startDate: yearMonthSchema,
    endDate: yearMonthSchema.nullable(),
  })
  .refine(isValidDateRange, dateRangeRefinement);

/** A list of projects with unique slugs. */
export const projectListSchema = z
  .array(projectSchema)
  .refine(
    (projects) => new Set(projects.map((p) => p.slug)).size === projects.length,
    "Project slugs must be unique",
  );

export type ProjectLinks = z.infer<typeof projectLinksSchema>;
export type Project = z.infer<typeof projectSchema>;
