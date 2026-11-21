import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/data";
import { jsonError, jsonResponse, preflightResponse, withApiErrorHandling } from "@/lib/http/api";

/**
 * Lists projects, newest first.
 * Optional query `?featured=true|false` filters by the featured flag.
 */
export const GET = withApiErrorHandling(async (request: NextRequest): Promise<Response> => {
  const featuredParam = request.nextUrl.searchParams.get("featured");
  if (featuredParam !== null && featuredParam !== "true" && featuredParam !== "false") {
    return jsonError(request, 400, "Query parameter 'featured' must be 'true' or 'false'");
  }

  const projects = await getRepository().getProjects(
    featuredParam === null ? {} : { featured: featuredParam === "true" },
  );
  return jsonResponse(request, projects);
});

/** CORS preflight. */
export const OPTIONS = preflightResponse;
