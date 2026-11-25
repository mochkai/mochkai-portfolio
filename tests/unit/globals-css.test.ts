// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Raw source of the global stylesheet (Vitest runs with `css: false`, so it is read as text). */
const css = readFileSync(
  fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("globals.css", () => {
  it("defines a single dark scheme with no light/dark media query", () => {
    expect(css).toMatch(/color-scheme:\s*dark;/);
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css.match(/^:root\s*\{/gm)).toHaveLength(1);
  });

  it("keeps the legacy token names and adds the Arcane Tech tokens", () => {
    for (const token of [
      "background",
      "surface",
      "surface-raised",
      "foreground",
      "muted",
      "line",
      "brand",
      "neon",
      "glow",
      "accent",
      "accent-foreground",
      "accent-soft",
    ]) {
      expect(css).toContain(`--${token}:`);
      expect(css).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it("turns off animations and transitions under prefers-reduced-motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).not.toBe(css);
    expect(block).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(block).toMatch(/animation-iteration-count:\s*1 !important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms !important/);
    expect(block).toMatch(/scroll-behavior:\s*auto !important/);
  });
});
