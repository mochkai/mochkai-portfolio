/**
 * Runs once when a Next.js server instance starts, before it handles any request.
 *
 * Validates the server environment up front so a misconfiguration (for example
 * `CORS_ALLOWED_ORIGINS="https://bad.example/"`) stops the server at boot instead of
 * surfacing on the first request that reads the config. Only the Node.js runtime is
 * checked: the config module is `server-only` and reads `process.env`, and the app runs no
 * Edge code. See `validateServerConfigOrExit()` in `instrumentation-node.ts` for why an
 * invalid config exits the process.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Imported lazily so Node-only code stays out of the Edge instrumentation bundle.
    const { validateServerConfigOrExit } = await import("./instrumentation-node");
    validateServerConfigOrExit();
  }
}
