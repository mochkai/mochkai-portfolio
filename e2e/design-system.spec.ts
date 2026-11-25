import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Pages that must render on the dark scheme with the Arcane Tech fonts. */
const PAGES = ["/", "/about", "/projects", "/experience"] as const;

/** Real markup of an interactive Card holding a primary Button, rendered from the primitives. */
const PRIMITIVES_HTML = renderToStaticMarkup(
  createElement(
    Card,
    { interactive: true, "data-testid": "e2e-card" } as Parameters<typeof Card>[0],
    createElement(Button, { "data-testid": "e2e-button" } as Parameters<typeof Button>[0], "Go"),
  ),
);

/** Appends the primitives to `<main>` so they are styled by the production stylesheet. */
async function injectPrimitives(page: Page) {
  await page.goto("/");
  await page.evaluate((html) => {
    document.querySelector("main")!.insertAdjacentHTML("afterbegin", html);
  }, PRIMITIVES_HTML);
}

/** Computed transition of the element with `testId`. */
function transitionOf(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const style = getComputedStyle(el);
    return { property: style.transitionProperty, duration: style.transitionDuration };
  });
}

test.describe("design system", () => {
  for (const path of PAGES) {
    test(`${path} renders on the dark background with the new fonts`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      const styles = await page.evaluate(() => {
        const h1 = document.querySelector("h1")!;
        return {
          scheme: getComputedStyle(document.documentElement).colorScheme,
          background: getComputedStyle(document.body).backgroundColor,
          bodyFont: getComputedStyle(document.body).fontFamily,
          h1Font: getComputedStyle(h1).fontFamily,
          loaded: {
            display: document.fonts.check('16px "Space Grotesk"'),
            body: document.fonts.check('16px "Inter"'),
          },
        };
      });
      expect(styles.scheme).toBe("dark");
      expect(styles.background).toBe("rgb(7, 9, 15)");
      expect(styles.bodyFont).toMatch(/^Inter\b/);
      expect(styles.h1Font).toMatch(/^"?Space Grotesk"?\b/);
      expect(styles.loaded).toEqual({ display: true, body: true });
    });
  }

  for (const width of [375, 768, 1280]) {
    test(`pages do not scroll horizontally at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  }

  test("technology tags use JetBrains Mono", async ({ page }) => {
    await page.goto("/projects");
    const tag = page
      .getByRole("list", { name: /Technologies/ })
      .first()
      .locator("span")
      .first();
    await expect(tag).toHaveCSS("font-family", /^"?JetBrains Mono"?/);
  });

  test("interactive Card and Button animate for 150 ms when motion is allowed", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await injectPrimitives(page);
    for (const id of ["e2e-card", "e2e-button"]) {
      const { property, duration } = await transitionOf(page, id);
      expect(property).not.toBe("none");
      expect(duration).toMatch(/^0\.15s/);
    }
  });

  test("interactive Card and Button transitions are off under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await injectPrimitives(page);
    for (const id of ["e2e-card", "e2e-button"]) {
      const { property, duration } = await transitionOf(page, id);
      // `motion-reduce:transition-none`, and the global baseline shortens anything left over.
      expect(property === "none" || /^(0s|1e-05s|0\.00001s)/.test(duration)).toBe(true);
    }
  });
});
