import type { Experience } from "@/lib/schemas";

/**
 * How many of the most recent companies may show their dates (DESIGN.md "Content and privacy").
 * The one place this number is set: the Experience page and `/api/experience` both use it
 * through {@link toPublicExperience}.
 *
 * `0` (the owner's current choice) means no entry is dated anywhere. Raising it, for example to
 * `4`, dates every role at the 4 most recent companies and leaves older roles undated.
 */
export const DATED_COMPANY_LIMIT = 0;

/** Every public field of an entry except the dates, plus a date-free `current` flag. */
interface PublicExperienceBase extends Omit<Experience, "startDate" | "endDate"> {
  /**
   * Whether the role is ongoing (`endDate: null`). Carries no date, range or duration, so it is
   * kept on undated entries too and may be shown as "Current".
   */
  current: boolean;
}

/** An entry at one of the most recent companies: it keeps `startDate` and `endDate`. */
export interface DatedExperience extends PublicExperienceBase {
  startDate: Experience["startDate"];
  endDate: Experience["endDate"];
}

/**
 * An entry at an older company: `startDate` and `endDate` are absent (the keys are omitted,
 * not `null` or empty), and the type forbids setting them.
 */
export interface UndatedExperience extends PublicExperienceBase {
  startDate?: never;
  endDate?: never;
}

/** An experience entry as it may leave the server (page HTML, RSC payload, API responses). */
export type PublicExperience = DatedExperience | UndatedExperience;

/**
 * Narrows a {@link PublicExperience} to a {@link DatedExperience}.
 *
 * @param entry - A redacted entry.
 * @returns `true` when the entry kept its dates.
 */
export function isDatedExperience(entry: PublicExperience): entry is DatedExperience {
  return entry.startDate !== undefined;
}

/**
 * Collects the `limit` most recent distinct companies: walks the entries in the given order
 * (the repository's newest-first order) and adds each trimmed `company` string until the set
 * holds `limit` names. Several roles at one company count once.
 *
 * @param entries - Full entries, newest first.
 * @param limit - Maximum number of companies to collect.
 * @returns The trimmed company names.
 */
export function getDatedCompanies(
  entries: readonly Pick<Experience, "company">[],
  limit: number = DATED_COMPANY_LIMIT,
): Set<string> {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError(`Dated company limit must be a non-negative integer, got ${limit}`);
  }
  const companies = new Set<string>();
  for (const entry of entries) {
    if (companies.size >= limit) break;
    companies.add(entry.company.trim());
  }
  return companies;
}

/**
 * Redacts experience for public output. Order is kept; entries at the `limit` most recent
 * companies (see {@link getDatedCompanies}) keep `startDate`/`endDate`, every other entry has both
 * keys removed. Every entry gets a date-free `current` flag. The input is not mutated (nested
 * `highlights` and `tech` arrays are shared, not copied; repository data is deep-frozen).
 *
 * The repository keeps returning full entries so it can still order them by date; every output
 * boundary (the Experience page, `/api/experience`, any future metadata or feed) must go through
 * this function.
 *
 * @param entries - Full entries from the repository, newest first.
 * @param limit - How many recent companies stay dated. Defaults to {@link DATED_COMPANY_LIMIT}.
 * @returns The redacted entries, in the same order.
 * @throws RangeError when `limit` is negative or not an integer.
 */
export function toPublicExperience(
  entries: readonly Experience[],
  limit: number = DATED_COMPANY_LIMIT,
): PublicExperience[] {
  const datedCompanies = getDatedCompanies(entries, limit);
  return entries.map((entry): PublicExperience => {
    // An allowlist rather than "everything but the dates": a field added to the schema later
    // fails the type check here until it is deliberately listed, so nothing new leaks by default.
    const { id, company, role, location, highlights, tech } = entry;
    const base: PublicExperienceBase = {
      id,
      company,
      role,
      location,
      highlights,
      tech,
      current: entry.endDate === null,
    };
    if (!datedCompanies.has(company.trim())) return base;
    return { ...base, startDate: entry.startDate, endDate: entry.endDate };
  });
}
