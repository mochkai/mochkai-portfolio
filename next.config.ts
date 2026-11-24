import type { NextConfig } from "next";

/**
 * Security headers sent on every response (pages, API routes and static files).
 * They do not overlap with the `Access-Control-*` / `Vary` headers the API sets for CORS.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Both forbid embedding the site in frames: X-Frame-Options for older browsers,
  // CSP frame-ancestors for current ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle (`.next/standalone/server.js`) for the Docker image.
  output: "standalone",
  // Do not advertise the framework in an `X-Powered-By` header.
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /** Applies {@link securityHeaders} to all routes. */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
