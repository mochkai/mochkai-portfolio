import { z } from "zod";
import { dateRangeRefinement, isValidDateRange, yearMonthSchema } from "./common";

/**
 * One role at one company. `endDate: null` means the role is current; otherwise it must
 * not be before `startDate`.
 */
export const experienceSchema = z
  .object({
    id: z.string().min(1),
    company: z.string().min(1),
    role: z.string().min(1),
    location: z.string().min(1),
    startDate: yearMonthSchema,
    endDate: yearMonthSchema.nullable(),
    highlights: z.array(z.string().min(1)),
    tech: z.array(z.string().min(1)),
  })
  .refine(isValidDateRange, dateRangeRefinement);

/** A list of experience entries with unique ids. */
export const experienceListSchema = z
  .array(experienceSchema)
  .refine(
    (entries) => new Set(entries.map((e) => e.id)).size === entries.length,
    "Experience ids must be unique",
  );

export type Experience = z.infer<typeof experienceSchema>;
