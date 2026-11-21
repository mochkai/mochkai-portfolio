/**
 * Copies `public/` and `.next/static/` into `.next/standalone/` after `next build`,
 * so `node .next/standalone/server.js` (the `start` script) serves assets locally,
 * the same way the production Docker image does.
 */
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";

if (!existsSync(standalone)) {
  console.error(`${standalone} not found. Is output: "standalone" set in next.config.ts?`);
  process.exit(1);
}

cpSync("public", `${standalone}/public`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
console.log("Copied public/ and .next/static/ into .next/standalone/");
