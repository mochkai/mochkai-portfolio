import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/data";
import { jsonError, jsonResponse, preflightResponse, withApiErrorHandling } from "@/lib/http/api";
import { slugSchema } from "@/lib/schemas";

/** Error body for unknown or malformed slugs. Raw input is never echoed back. */
const NOT_FOUND_MESSAGE = "Project not found";

/**
 * Returns one project by slug, or 404 `{ error }` when it does not exist.
 * Slugs that are not well-formed are rejected with 404 before the repository is queried.
 */
export const GET = withApiErrorHandling(
  async (request: NextRequest, ctx: RouteContext<"/api/projects/[slug]">): Promise<Response> => {
    const parsed = slugSchema.safeParse((await ctx.params).slug);
    if (!parsed.success) return jsonError(request, 404, NOT_FOUND_MESSAGE);

    const project = await getRepository().getProjectBySlug(parsed.data);
    if (!project) return jsonError(request, 404, NOT_FOUND_MESSAGE);
    return jsonResponse(request, project);
  },
);

/** CORS preflight. */
export const OPTIONS = preflightResponse;
