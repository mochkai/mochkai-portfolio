import { expect, test } from "@playwright/test";

/** Tester-added checks for the HUD frame (issue #5): responsive overflow and sticky header. */
test.describe("HUD frame layout", () => {
  for (const width of [375, 768, 1280]) {
    test(`no horizontal scroll at ${width} px on any main page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/", "/projects", "/projects/project-one", "/experience", "/about"]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
        // Header nav links are all fully on screen.
        for (const link of await page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link")
          .all()) {
          await expect(link).toBeInViewport({ ratio: 1 });
        }
      }
    });
  }

  test("skip link target is not hidden under the sticky header at 1280 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/about");
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    const headerBottom = await page
      .getByRole("banner")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const firstHeadingTop = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(firstHeadingTop).toBeGreaterThanOrEqual(headerBottom);
  });

  test("header stays on screen while scrolling at 1280 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/about");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("navigation", { name: "Main" })).toBeInViewport();
  });
});
