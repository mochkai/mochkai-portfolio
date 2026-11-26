import { getRepository } from "@/lib/data";
import { DATED_COMPANY_LIMIT, toPublicExperience } from "@/lib/experience";
import { jsonResponse, preflightResponse, withApiErrorHandling } from "@/lib/http/api";

/**
 * Returns work experience, most recent first, redacted with {@link toPublicExperience}: entries
 * outside the {@link DATED_COMPANY_LIMIT} most recent companies (currently all of them) have no
 * `startDate`/`endDate` keys. Each entry has a date-free `current` flag.
 */
export const GET = withApiErrorHandling(async (request: Request): Promise<Response> => {
  const experience = await getRepository().getExperience();
  return jsonResponse(request, toPublicExperience(experience, DATED_COMPANY_LIMIT));
});

/** CORS preflight. */
export const OPTIONS = preflightResponse;
