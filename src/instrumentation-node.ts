import { getServerConfig } from "@/lib/config/server";

/**
 * Parses the server environment and stops startup when it is invalid.
 *
 * Next.js catches errors thrown from `register()`, logs "Failed to prepare server" and keeps
 * listening while answering every request with a 500. In production that hides the failure
 * from Docker or a process manager, so this logs the invalid variables and exits with code 1.
 * Under `next dev` (`NODE_ENV=development`) it only logs: `next dev` treats any error thrown
 * from `register()` as fatal and exits, so rethrowing would also stop the dev server. Kept
 * running, every request that reads the config fails with the same error, which the dev
 * error overlay shows until the environment is fixed and the server restarted.
 *
 * Node.js only (uses `process.exit`); `register()` imports it under `NEXT_RUNTIME=nodejs`.
 *
 * @throws Error listing every invalid variable (only reached if `process.exit` is stubbed).
 */
export function validateServerConfigOrExit(): void {
  try {
    getServerConfig();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[startup] Invalid configuration; the dev server keeps running but requests that read it will fail until it is fixed.",
        error,
      );
      return;
    }
    console.error("[startup] Invalid configuration, refusing to start.", error);
    process.exit(1);
    throw error;
  }
}
