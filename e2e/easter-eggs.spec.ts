import { expect, test, type Page } from "@playwright/test";

/**
 * Easter eggs (#13): the secret arrow-key input engages overdrive and shows a toast; partial or
 * wrong input and typing in a form field do not; the effect ends on its own and can be
 * dismissed without stealing focus; reduced motion gets a still variant; rapid logo clicks and
 * the console greeting; no horizontal scrolling at 375 / 768 / 1280 px.
 */

/** The secret input, as Playwright key names. */
const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

/** Presses each key in turn. */
async function press(page: Page, keys: readonly string[] = CODE) {
  for (const key of keys) await page.keyboard.press(key);
}

/** The Easter egg toast. */
function toast(page: Page) {
  return page.getByTestId("easter-egg-toast");
}

/** Waits until the page has hydrated (the client listener is attached after hydration). */
async function gotoHydrated(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Running animations (CSS or Web Animations) that last longer than the reduced-motion baseline. */
function movingAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        if (animation.playState === "finished" || animation.playState === "idle") return false;
        const active = Number(animation.effect?.getComputedTiming().activeDuration ?? 0);
        return !Number.isFinite(active) || active > 0.011;
      })
      .map((animation) =>
        "animationName" in animation ? (animation as CSSAnimation).animationName : "transition",
      ),
  );
}

test.describe("Easter eggs", () => {
  test("the secret input engages overdrive and shows a dismissible toast", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydrat/i.test(message.text())) errors.push(message.text());
    });
    await gotoHydrated(page);
    await expect(toast(page)).toHaveCount(0);

    await press(page);
    await expect(page.getByRole("region", { name: "Overdrive engaged" })).toBeVisible();
    await expect(page.getByTestId("easter-egg-status")).toHaveText(/Cheat code accepted/);
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "true");
    await expect(page.getByTestId("arcane-canvas")).toHaveAttribute("data-overdrive", "true");

    await toast(page).getByRole("button", { name: "Dismiss" }).click();
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "false");
    expect(errors).toEqual([]);
  });

  test("ends on its own and never steals focus", async ({ page }) => {
    await gotoHydrated(page);
    const link = page.getByRole("link", { name: "Projects", exact: true }).first();
    await link.focus();
    await press(page);
    await expect(toast(page)).toBeVisible();
    await expect(link).toBeFocused();
    // Overdrive lasts 4 s, the toast 6 s.
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "false", {
      timeout: 6000,
    });
    await page.mouse.move(0, 0);
    await expect(toast(page)).toHaveCount(0, { timeout: 8000 });
  });

  test("Escape closes the toast", async ({ page }) => {
    await gotoHydrated(page);
    await press(page);
    await expect(toast(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toast(page)).toHaveCount(0);
  });

  test("partial and wrong sequences do nothing", async ({ page }) => {
    await gotoHydrated(page);
    await press(page, CODE.slice(0, 9));
    await press(page, [...CODE.slice(0, 8), "a", "b"]);
    await page.waitForTimeout(300);
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "false");
  });

  test("typing the sequence in a form field does nothing", async ({ page }) => {
    await gotoHydrated(page);
    // The site has no form, so add a field for the test.
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.setAttribute("aria-label", "Test field");
      document.getElementById("main")?.prepend(input);
    });
    await page.getByLabel("Test field").focus();
    await press(page);
    await page.waitForTimeout(300);
    await expect(toast(page)).toHaveCount(0);
  });

  test("five quick logo clicks show a message", async ({ page }) => {
    await gotoHydrated(page);
    const logo = page.getByRole("banner").locator('[data-easter-egg="logo"]');
    for (let i = 0; i < 5; i++) await logo.click();
    await expect(page.getByRole("region", { name: "Logo fully charged" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("greets developers in the console once", async ({ page }) => {
    const greetings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "info" && /fellow developer/.test(message.text())) {
        greetings.push(message.text());
      }
    });
    await gotoHydrated(page);
    await page.getByRole("link", { name: "About", exact: true }).first().click();
    await expect(page).toHaveURL(/\/about$/);
    expect(greetings).toHaveLength(1);
  });

  for (const width of [375, 768, 1280]) {
    test(`the toast fits at ${width} px without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page);
      await press(page);
      const box = await toast(page).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("Easter eggs under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("overdrive is a still color change: toast shown, nothing moves", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHydrated(page);
    const fill = page.getByTestId("boost-meter-fill");
    const calmFilter = await fill.evaluate((element) => getComputedStyle(element).filter);

    await press(page);
    await expect(toast(page)).toBeVisible();
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "true");
    await expect(page.getByTestId("arcane-canvas")).toHaveAttribute("data-animating", "false");
    // Static color change: the fill is brighter, with no animation.
    const surgeFilter = await fill.evaluate((element) => getComputedStyle(element).filter);
    expect(surgeFilter).not.toBe(calmFilter);
    expect(await fill.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await toast(page).evaluate((element) => getComputedStyle(element).animationName)).toBe(
      "none",
    );
    expect(await movingAnimations(page)).toEqual([]);
  });
});

test.describe("Easter eggs: tester checks", () => {
  test("arrow keys still scroll the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await gotoHydrated(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("typing the sequence in a textarea and a contenteditable does nothing", async ({ page }) => {
    await gotoHydrated(page);
    await page.evaluate(() => {
      const area = document.createElement("textarea");
      area.setAttribute("aria-label", "Test area");
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.setAttribute("aria-label", "Test editable");
      editable.setAttribute("role", "textbox");
      document.getElementById("main")?.prepend(area, editable);
    });
    await page.getByLabel("Test area").focus();
    await press(page);
    await page.getByLabel("Test editable").focus();
    await press(page);
    await page.waitForTimeout(300);
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "false");
  });

  for (const width of [375, 1280]) {
    test(`the toast is position fixed and inside the viewport at ${width} px, even when scrolled`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      await gotoHydrated(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await press(page);
      await expect(toast(page)).toBeVisible();
      expect(await toast(page).evaluate((element) => getComputedStyle(element).position)).toBe(
        "fixed",
      );
      const box = (await toast(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(700);
      // Top on phones (clear of the bottom achievement toast), bottom-left from 640 px.
      if (width < 640) expect(box.y).toBeLessThan(350);
      else expect(box.y + box.height).toBeGreaterThan(350);
    });
  }

  test("logo clicks still navigate Home from another page", async ({ page }) => {
    await gotoHydrated(page, "/about");
    const logo = page.getByRole("banner").locator('[data-easter-egg="logo"]');
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    for (let i = 0; i < 4; i++) await logo.click();
    await expect(page.getByRole("region", { name: "Logo fully charged" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("four logo clicks do not show the message", async ({ page }) => {
    await gotoHydrated(page);
    const logo = page.getByRole("banner").locator('[data-easter-egg="logo"]');
    for (let i = 0; i < 4; i++) await logo.click();
    await page.waitForTimeout(300);
    await expect(toast(page)).toHaveCount(0);
  });
});
