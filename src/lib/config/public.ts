import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // Future integration: URL of the separate chatbot app that consumes this site's /api routes.
  NEXT_PUBLIC_CHATBOT_URL: z.url().optional(),
});

export type PublicConfig = z.infer<typeof publicEnvSchema>;

/**
 * Validated `NEXT_PUBLIC_*` variables, safe for client and server code.
 * Each variable is read by its literal name so Next.js can inline it at build time.
 */
export const publicConfig: PublicConfig = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_CHATBOT_URL: process.env.NEXT_PUBLIC_CHATBOT_URL || undefined,
});
