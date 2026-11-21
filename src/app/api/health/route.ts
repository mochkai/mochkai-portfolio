/**
 * Liveness check used by the Docker HEALTHCHECK.
 * @returns `{ "status": "ok" }`
 */
export async function GET(): Promise<Response> {
  return Response.json({ status: "ok" });
}
