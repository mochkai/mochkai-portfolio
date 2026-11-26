import { expect, test } from "@playwright/test";

/**
 * Extra acceptance checks for the Arcane backdrop (#11) with motion allowed: it shows on every
 * page (including a project detail page), never takes keyboard focus, and the animated loop,
 * pointer reaction and parallax raise no console errors.
 */

/** Static routes plus the first project's detail page. */
async function allPaths(request: import("@playwright/test").APIRequestContext) {
  const projects: { slug: string }[] = await (await request.get("/api/projects")).json();
  const paths = ["/", "/projects", "/experience", "/about"];
  if (projects.length > 0) paths.push(`/projects/${projects[0].slug}`);
  return paths;
}

test.describe("arcane backdrop with motion allowed", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("animates on every page with no console errors while the pointer moves and the page scrolls", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const path of await allPaths(page.request)) {
      await test.step(path, async () => {
        await page.goto(path);
        const canvas = page.getByTestId("arcane-canvas");
        await expect(canvas).toBeVisible();
        await expect(canvas).toHaveAttribute("data-animating", "true");
        await page.mouse.move(200, 200);
        await page.mouse.move(700, 400, { steps: 8 });
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(200);
      });
    }
    expect(errors).toEqual([]);
  });

  test("never takes keyboard focus", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const inBackdrop = await page.evaluate(
        () => document.activeElement?.closest("[data-testid='arcane-background']") != null,
      );
      expect(inBackdrop, `tab stop ${i + 1}`).toBe(false);
    }
    await expect(page.getByTestId("arcane-canvas")).not.toHaveAttribute("tabindex", /.*/);
  });

  test("canvas backing store is capped at 2x device pixels", async ({ browser }) => {
    const context = await browser.newContext({
      deviceScaleFactor: 3,
      viewport: { width: 400, height: 700 },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await page.goto("/");
    const canvas = page.getByTestId("arcane-canvas");
    await expect(canvas).toHaveAttribute("data-animating", "true");
    const size = await canvas.evaluate((el) => ({
      width: (el as HTMLCanvasElement).width,
      css: el.clientWidth,
    }));
    expect(size.width).toBe(size.css * 2);
    await context.close();
  });

  // Pixel comparisons between two touch positions are not stable here (the ambient pulse keeps
  // changing the frame and the clock cannot be pinned to one paint), so this checks the gate
  // inputs and the loop. That no pointer listener is attached without a fine pointer is
  // covered by `src/lib/arcane-field.test.ts` ("listens to the pointer only with a fine pointer").
  test("touch devices report no fine pointer and keep the ambient loop running", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 700 },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await page.goto("/");
    const canvas = page.getByTestId("arcane-canvas");
    await expect(canvas).toHaveAttribute("data-animating", "true");
    const fine = await page.evaluate(
      () => matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    expect(fine).toBe(false);
    await context.close();
  });
});
