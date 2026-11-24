import "server-only";
import { getServerConfig } from "@/lib/config/server";
import { resolveCorsHeaders } from "./cors";

/** Headers for `request` based on `CORS_ALLOWED_ORIGINS` (none allowed by default). */
function corsHeadersFor(request: Request): Record<string, string> {
  return resolveCorsHeaders(request.headers.get("origin"), getServerConfig().CORS_ALLOWED_ORIGINS);
}

/** Returns `data` as JSON with CORS headers applied for the request's origin. */
export function jsonResponse(request: Request, data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(corsHeadersFor(request))) headers.set(key, value);
  return Response.json(data, { ...init, headers });
}

/** Returns a JSON error body `{ error }` with the given status and CORS headers. */
export function jsonError(request: Request, status: number, message: string): Response {
  return jsonResponse(request, { error: message }, { status });
}

/** Answers a CORS preflight request. Export it as `OPTIONS` from API route files. */
export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
}

/** Body message for unexpected failures; details stay in the server log. */
export const INTERNAL_ERROR_MESSAGE = "Internal server error";

/**
 * Wraps a route handler so an unexpected error (e.g. content failing validation, or a
 * remote content source being down) becomes a `500 { error }` JSON response with CORS
 * headers, instead of Next.js's default error page. The real error is logged on the server.
 * If the CORS headers cannot be built either (invalid server config), the 500 JSON body is
 * still returned, without CORS headers.
 *
 * @example export const GET = withApiErrorHandling(async (request) => jsonResponse(request, data));
 */
export function withApiErrorHandling<Args extends [Request, ...unknown[]]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const [request] = args;
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed:`, error);
      try {
        return jsonError(request, 500, INTERNAL_ERROR_MESSAGE);
      } catch (corsError) {
        // Building CORS headers reads the server config, which can itself throw (e.g. an
        // invalid CORS_ALLOWED_ORIGINS). Still answer with the JSON 500, just without CORS.
        console.error("[api] could not build CORS headers for the error response:", corsError);
        return Response.json({ error: INTERNAL_ERROR_MESSAGE }, { status: 500 });
      }
    }
  };
}
