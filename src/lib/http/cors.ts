/** Methods exposed by the read-only API. */
const ALLOWED_METHODS = "GET, OPTIONS";

/**
 * Builds CORS response headers for a request origin.
 *
 * Returns only `Vary: Origin` when the origin is missing or not allowed, so browsers
 * block the cross-origin read. `"*"` in `allowedOrigins` allows any origin.
 */
export function resolveCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (!origin) return headers;

  const allowAll = allowedOrigins.includes("*");
  if (!allowAll && !allowedOrigins.includes(origin)) return headers;

  headers["Access-Control-Allow-Origin"] = allowAll ? "*" : origin;
  headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS;
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Max-Age"] = "86400";
  return headers;
}
