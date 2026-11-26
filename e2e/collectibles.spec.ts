import { expect, test, type Page } from "@playwright/test";

/**
 * Hidden collectibles (#12): collecting with mouse, touch and keyboard, progress across
 * reloads, the HUD counter, the achievement toast, blocked storage, hydration, layout (no
 * overlap at 375 / 768 / 1280 px) and reduced motion.
 */

/** Must match `PROGRESS_STORAGE_KEY` in `src/lib/collectible-progress.ts`. */
const STORAGE_KEY = "mochkai:collectibles:v1";

/** Every shard id in display order, with the page it lives on (the detail page is resolved). */
const SHARDS = [
  { id: "title-screen", path: "/" },
  { id: "quest-board", path: "/projects" },
  { id: "quest-loot", path: "/projects/project-one" },
  { id: "quest-log-end", path: "/experience" },
  { id: "character-sheet", path: "/about" },
] as const;

/** The shard button on the current page. */
function shard(page: Page, id: string) {
  return page.getByTestId(`collectible-${id}`);
}

/** The HUD rune counter in the header. */
function counter(page: Page) {
  return page.getByRole("banner").getByTestId("collectible-counter");
}

/** Collects errors, hydration warnings and uncaught exceptions while a test runs. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || /hydrat/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

/**
 * Seeds stored progress before any page script runs. Only when nothing is stored yet, so a
 * reload keeps what the test collected since.
 */
async function seedProgress(page: Page, ids: readonly string[]) {
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
    },
    [STORAGE_KEY, JSON.stringify(ids)] as const,
  );
}

test.describe("Hidden collectibles", () => {
  test("collecting one shard shows the counter, which survives a reload", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(counter(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Collect rune shard 1 of 5" }).click();
    await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
    await expect(page.getByTestId("collectible-status")).toHaveText(/Rune shard 1 found/);
    await expect(page.getByRole("button", { name: "Rune shard 1 of 5, collected" })).toBeVisible();

    await page.reload();
    await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
    await expect(shard(page, "title-screen")).toHaveAttribute("data-collected", "true");
    // The counter follows the visitor to every page.
    await page.goto("/about");
    await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
    expect(errors).toEqual([]);
  });

  test("can be collected with the keyboard", async ({ page }) => {
    await page.goto("/projects");
    const button = page.getByRole("button", { name: "Collect rune shard 2 of 5" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Rune shard 2 of 5, collected" })).toBeFocused();
    await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
  });

  test.describe("on a touch screen", () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });

    test("can be collected by tapping", async ({ page }) => {
      await page.goto("/experience");
      await shard(page, "quest-log-end").tap();
      await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
    });
  });

  test("hydrates stored progress without warnings", async ({ page }) => {
    const errors = watchErrors(page);
    await seedProgress(page, ["quest-board", "quest-loot"]);
    for (const { path } of SHARDS) {
      await page.goto(path);
      await expect(counter(page)).toHaveText(/Runes\s*2\/5/);
    }
    expect(errors).toEqual([]);
  });

  test("works without errors when localStorage throws", async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Storage is blocked", "SecurityError");
        },
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Collect rune shard 1 of 5" }).click();
    await expect(counter(page)).toHaveText(/Runes\s*1\/5/);
    expect(errors).toEqual([]);
  });

  test("finding every shard unlocks a dismissible achievement", async ({ page }) => {
    await seedProgress(page, ["title-screen", "quest-board", "quest-loot", "quest-log-end"]);
    await page.goto("/about");
    await expect(page.getByTestId("achievement-toast")).toHaveCount(0);
    await page.getByRole("button", { name: "Collect rune shard 5 of 5" }).click();

    const toast = page.getByRole("region", { name: "All 5 rune shards found" });
    await expect(toast).toBeVisible();
    await expect(counter(page)).toHaveText(/Runes\s*5\/5/);
    await page.keyboard.press("Escape");
    await expect(toast).toHaveCount(0);

    // Not shown again on later visits.
    await page.reload();
    await expect(counter(page)).toHaveText(/Runes\s*5\/5/);
    await expect(page.getByTestId("achievement-toast")).toHaveCount(0);
  });

  for (const width of [375, 768, 1280]) {
    test(`shards have 44 px targets and overlap no content at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      // Seed every shard so the header counter is shown too.
      await seedProgress(
        page,
        SHARDS.map((item) => item.id),
      );
      for (const { id, path } of SHARDS) {
        await page.goto(path);
        const button = shard(page, id);
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box?.width, `${id} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height, `${id} height`).toBeGreaterThanOrEqual(44);

        const overlaps = await button.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          const selector = "h1,h2,h3,h4,p,a,button,img,li,dt,dd,summary,input,label";
          return [...document.querySelectorAll<HTMLElement>(selector)]
            .filter(
              (el) =>
                el !== target &&
                !el.contains(target) &&
                !target.contains(el) &&
                !el.closest('[aria-hidden="true"]') &&
                el.checkVisibility(),
            )
            .filter((el) => {
              const other = el.getBoundingClientRect();
              const x = Math.min(rect.right, other.right) - Math.max(rect.left, other.left);
              const y = Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top);
              return x > 0.5 && y > 0.5;
            })
            .map((el) => `${el.tagName.toLowerCase()}: ${el.textContent?.trim().slice(0, 40)}`);
        });
        expect(overlaps, `${id} on ${path} at ${width}px`).toEqual([]);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
      // The counter never pushes a nav link off screen.
      await expect(counter(page)).toBeVisible();
      for (const link of await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link")
        .all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
      }
    });
  }

  test("collecting under reduced motion runs no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedProgress(page, ["title-screen", "quest-board", "quest-loot", "quest-log-end"]);
    await page.goto("/about");
    const button = shard(page, "character-sheet");
    await button.click();
    await expect(page.getByTestId("achievement-toast")).toBeVisible();

    for (const target of [button, page.getByTestId("achievement-toast")]) {
      expect(await target.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    }
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .map((animation) => Number(animation.effect?.getComputedTiming().activeDuration ?? 0))
        .filter((duration) => !Number.isFinite(duration) || duration > 0.011),
    );
    expect(running).toEqual([]);
  });
});
