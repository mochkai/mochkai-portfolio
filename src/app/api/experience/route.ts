import { getRepository } from "@/lib/data";
import { jsonResponse, preflightResponse, withApiErrorHandling } from "@/lib/http/api";

/** Returns work experience, most recent first. */
export const GET = withApiErrorHandling(async (request: Request): Promise<Response> => {
  const experience = await getRepository().getExperience();
  return jsonResponse(request, experience);
});

/** CORS preflight. */
export const OPTIONS = preflightResponse;
