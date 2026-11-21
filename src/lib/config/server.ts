import "server-only";
import { z } from "zod";

/**
 * Data sources the app knows how to read from. Only `json` is implemented today;
 * add e.g. `"cms"` or `"http"` here together with a matching case in `getRepository()`.
 */
export const DATA_SOURCES = ["json"] as const;

/**
 * True for `*` or an exact origin (`scheme://host[:port]`), i.e. a URL that equals its own
 * `origin`. Rejects paths, trailing slashes, bare hosts and non-normalized forms, because
 * browsers send the `Origin` header in exactly that form and matching is by string equality.
 */
export function isValidCorsOrigin(value: string): boolean {
  if (value === "*") return true;
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const corsOriginSchema = z.string().refine(isValidCorsOrigin, {
  error: (issue) =>
    `Invalid origin ${JSON.stringify(issue.input)}: use "*" or an origin like ` +
    `https://example.com (scheme, host and optional port; no path or trailing slash)`,
});

/** Splits a comma-separated env value into trimmed, non-empty origins and validates each. */
const corsOriginList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )
  .pipe(z.array(corsOriginSchema));

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_SOURCE: z.enum(DATA_SOURCES).default("json"),
  CORS_ALLOWED_ORIGINS: corsOriginList,
  // Placeholders for a future remote content source (headless CMS or content API).
  CONTENT_API_URL: z.url().optional(),
  CONTENT_API_TOKEN: z.string().min(1).optional(),
});

export type ServerConfig = z.infer<typeof serverEnvSchema>;

/**
 * Parses server-side environment variables.
 * Throws with a readable message listing every invalid variable.
 */
export function parseServerConfig(env: Record<string, string | undefined>): ServerConfig {
  // Treat empty strings as unset so `FOO=` in an .env file falls back to defaults.
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: ServerConfig | undefined;

/** Returns the validated server config, parsing `process.env` once per process. */
export function getServerConfig(): ServerConfig {
  cached ??= parseServerConfig(process.env);
  return cached;
}
