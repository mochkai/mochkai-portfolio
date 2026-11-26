import { expect, test } from "@playwright/test";

/**
 * Hidden collectibles (#12), accessibility extras: shards are reachable with Tab and show a
 * visible focus ring, and the achievement toast's Dismiss button closes it and gives focus back.
 */

/** Must match `PROGRESS_STORAGE_KEY` in `src/lib/collectible-progress.ts`. */
const STORAGE_KEY = "mochkai:collectibles:v1";

test.describe("Hidden collectibles: keyboard and focus", () => {
  for (const path of ["/", "/projects", "/projects/project-one", "/experience", "/about"]) {
    test(`the shard on ${path} is reachable with Tab and shows a focus ring`, async ({ page }) => {
      await page.goto(path);
      const shard = page.getByRole("button", { name: /^Collect rune shard \d of 5$/ });
      await expect(shard).toHaveCount(1);
      let focused = false;
      for (let i = 0; i < 60 && !focused; i++) {
        await page.keyboard.press("Tab");
        focused = await shard.evaluate((el) => el === document.activeElement);
      }
      expect(focused, "shard reached with Tab").toBe(true);
      const ring = await shard.evaluate((el) => {
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBeGreaterThanOrEqual(2);
    });
  }

  for (const width of [375, 1280]) {
    test(`the achievement toast is pinned inside the viewport at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [
          STORAGE_KEY,
          JSON.stringify(["title-screen", "quest-board", "quest-loot", "quest-log-end"]),
        ],
      );
      await page.goto("/about");
      await page.getByRole("button", { name: "Collect rune shard 5 of 5" }).click();
      const toast = page.getByTestId("achievement-toast");
      await expect(toast).toBeVisible();
      expect(await toast.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
      await expect(toast).toBeInViewport({ ratio: 1 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  for (const width of [320, 375, 768, 1280]) {
    test(`the rune counter shares the name's row and adds no header row at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/projects");
      const header = page.getByRole("banner");
      const heightBefore = (await header.boundingBox())?.height ?? 0;
      await page.getByRole("button", { name: "Collect rune shard 2 of 5" }).click();
      const counter = header.getByTestId("collectible-counter");
      await expect(counter).toBeVisible();

      const home = header.getByRole("navigation", { name: "Main" }).getByRole("link").first();
      const [c, h] = [await counter.boundingBox(), await home.boundingBox()];
      const middle = (box: typeof c) => (box ? box.y + box.height / 2 : NaN);
      expect(Math.abs(middle(c) - middle(h)), "counter centred on the name's row").toBeLessThan(4);
      expect((c?.x ?? 0) >= (h?.x ?? 0) + (h?.width ?? 0), "counter after the name").toBe(true);
      expect((await header.boundingBox())?.height, "header height unchanged").toBeCloseTo(
        heightBefore,
        0,
      );
    });
  }

  test("Dismiss closes the achievement toast and returns focus to the shard", async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(["title-screen", "quest-board", "quest-loot", "quest-log-end"])],
    );
    await page.goto("/about");
    await page.getByRole("button", { name: "Collect rune shard 5 of 5" }).click();
    const toast = page.getByRole("region", { name: "All 5 rune shards found" });
    await expect(toast).toBeVisible();

    await toast.getByRole("button", { name: "Dismiss" }).focus();
    await page.keyboard.press("Enter");
    await expect(toast).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rune shard 5 of 5, collected" })).toBeFocused();
  });
});
