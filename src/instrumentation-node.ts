import { getServerConfig } from "@/lib/config/server";

/**
 * Parses the server environment and stops the process when it is invalid.
 *
 * Next.js catches errors thrown from `register()`, logs "Failed to prepare server" and keeps
 * listening while answering every request with a 500. To make the failure visible to Docker
 * or a process manager, this logs the invalid variables and exits with code 1 instead.
 *
 * Node.js only (uses `process.exit`); `register()` imports it under `NEXT_RUNTIME=nodejs`.
 *
 * @throws Error listing every invalid variable (only reached if `process.exit` is stubbed).
 */
export function validateServerConfigOrExit(): void {
  try {
    getServerConfig();
  } catch (error) {
    console.error("[startup] Invalid configuration, refusing to start.", error);
    process.exit(1);
    throw error;
  }
}
