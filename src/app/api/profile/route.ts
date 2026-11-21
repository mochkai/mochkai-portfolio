import { getRepository } from "@/lib/data";
import { jsonResponse, preflightResponse, withApiErrorHandling } from "@/lib/http/api";

/** Returns the site owner's profile as JSON. */
export const GET = withApiErrorHandling(async (request: Request): Promise<Response> => {
  const profile = await getRepository().getProfile();
  return jsonResponse(request, profile);
});

/** CORS preflight. */
export const OPTIONS = preflightResponse;
