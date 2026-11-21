import { z } from "zod";

/** A calendar month in `YYYY-MM` form, e.g. `2024-03`. Sorts correctly as a string. */
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a month in YYYY-MM format");

/**
 * An absolute `http:` or `https:` URL. Rejects `javascript:`, `data:`, `ftp:` and other
 * schemes, since these values are rendered as links and served to API consumers.
 */
export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  error: "Expected an http or https URL",
});

/**
 * A site-relative path such as `/images/x.svg`. Rejects protocol-relative `//host/...`
 * (and `/\host`, which browsers treat the same way), which would load from another origin.
 */
export const sitePathSchema = z
  .string()
  .regex(/^\/(?![/\\])/, "Expected a site-relative path starting with a single '/'");

/**
 * An image reference. Only site-relative paths for now, because `next/image` rejects remote
 * hosts that are not listed in `images.remotePatterns`. When a CMS adapter lands, add its
 * asset host to `remotePatterns` in `next.config.ts` and widen this to
 * `z.union([sitePathSchema, httpUrlSchema])`.
 */
export const imageSrcSchema = sitePathSchema;

/** URL-safe identifier used in routes, e.g. `my-project`. */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase, hyphenated slug");

/** Message used when an entry ends before it starts. */
export const END_BEFORE_START_MESSAGE = "endDate must not be before startDate";

/**
 * True when `endDate` is open (`null`) or not earlier than `startDate`.
 * `YYYY-MM` strings compare chronologically as plain strings.
 */
export function isValidDateRange({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string | null;
}): boolean {
  return endDate === null || endDate >= startDate;
}

/** Refinement options for {@link isValidDateRange}, reporting the issue on `endDate`. */
export const dateRangeRefinement = {
  message: END_BEFORE_START_MESSAGE,
  path: ["endDate"],
};
