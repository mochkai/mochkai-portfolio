import { expect, test, type Page } from "@playwright/test";

/**
 * Reduced-motion audit for the whole site (#11). Under `prefers-reduced-motion: reduce`, nothing
 * may animate or move: no running CSS animation or transition longer than the global baseline
 * (0.01 ms), no named animation at all (every animation lives under `motion-safe:`), no
 * transform on hover, press or open, no parallax and a static backdrop canvas. Everything is
 * checked with computed styles, the Web Animations API and canvas pixels, never class names.
 */

/** Static routes; the project detail page is added from the API. */
const STATIC_PATHS = ["/", "/projects", "/experience", "/about", "/this-page-does-not-exist"];

/**
 * The longest duration the reduced-motion baseline leaves (0.01 ms), in milliseconds, plus a
 * hair of slack: `1e-05s` parsed back to milliseconds is not exactly 0.01 in floating point.
 */
const BASELINE_MS = 0.01 + 1e-6;

/** Every route to audit: the static ones plus the first project's detail page. */
async function auditPaths(page: Page): Promise<string[]> {
  const response = await page.request.get("/api/projects");
  const projects: { slug: string }[] = await response.json();
  return projects.length > 0 ? [...STATIC_PATHS, `/projects/${projects[0].slug}`] : STATIC_PATHS;
}

/**
 * Animations and transitions that are running (or about to) and last longer than the baseline,
 * described as `tag#testid: name (duration)`. Uses `document.getAnimations()`, so it also sees
 * JS-driven Web Animations, not only CSS.
 */
function movingAnimations(page: Page): Promise<string[]> {
  return page.evaluate((baselineMs) => {
    return document
      .getAnimations()
      .filter((animation) => {
        if (animation.playState === "finished" || animation.playState === "idle") return false;
        const timing = animation.effect?.getComputedTiming();
        const active = Number(timing?.activeDuration ?? 0);
        return !Number.isFinite(active) || active > baselineMs;
      })
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        const name =
          "animationName" in animation
            ? (animation as CSSAnimation).animationName
            : "transitionProperty" in animation
              ? (animation as CSSTransition).transitionProperty
              : animation.id || "web-animation";
        const label = target
          ? `${target.tagName.toLowerCase()}#${target.getAttribute("data-testid") ?? ""}`
          : "?";
        const duration = animation.effect?.getComputedTiming().activeDuration;
        return `${label}: ${name} (${String(duration)} ms)`;
      });
  }, BASELINE_MS);
}

/**
 * Computed-style sweep of every element and its `::before` / `::after`: lists any that still
 * name an animation, or whose transition lasts longer than the baseline.
 */
function animatedStyles(page: Page): Promise<string[]> {
  return page.evaluate((baselineMs) => {
    /** Longest entry in a computed `<time>#` list, in milliseconds. */
    const longest = (list: string) =>
      Math.max(
        0,
        ...list.split(",").map((value) => {
          const time = value.trim();
          return time.endsWith("ms") ? parseFloat(time) : parseFloat(time) * 1000;
        }),
      );
    const problems: string[] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const label = `${element.tagName.toLowerCase()}${pseudo ?? ""}#${element.getAttribute("data-testid") ?? ""}.${String(element.getAttribute("class") ?? "").slice(0, 60)}`;
        if (style.animationName !== "none")
          problems.push(`${label} animation ${style.animationName}`);
        if (style.transitionProperty !== "none" && longest(style.transitionDuration) > baselineMs) {
          problems.push(`${label} transition ${style.transitionDuration}`);
        }
      }
    }
    return problems;
  }, BASELINE_MS);
}

/** The backdrop canvas pixels as a data URL (to compare frames). */
function canvasPixels(page: Page): Promise<string> {
  return page.getByTestId("arcane-canvas").evaluate((canvas) => {
    return (canvas as HTMLCanvasElement).toDataURL();
  });
}

/** Every parallax layer's inline and computed transform. */
function parallaxTransforms(page: Page) {
  return page.getByTestId("parallax-layer").evaluateAll((layers) =>
    layers.map((layer) => ({
      parallax: layer.getAttribute("data-parallax"),
      inline: (layer as HTMLElement).style.transform,
      computed: getComputedStyle(layer).transform,
    })),
  );
}

/** Computed `transform` and `translate` of an element (Tailwind v4 uses `translate`). */
function movement(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { transform: style.transform, translate: style.translate };
    });
}

test.describe("reduced motion audit", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("covers every page: no animation, no long transition, static backdrop", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      // The not-found route answers 404 on purpose; the browser logs that as a resource error.
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
        errors.push(message.text());
      }
    });

    for (const path of await auditPaths(page)) {
      await test.step(path, async () => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        // Smooth scrolling is off.
        await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");

        expect(await animatedStyles(page), `${path}: computed animations`).toEqual([]);
        expect(await movingAnimations(page), `${path}: running animations`).toEqual([]);

        // The backdrop painted one static frame and runs no loop.
        const canvas = page.getByTestId("arcane-canvas");
        await expect(canvas).toHaveAttribute("data-animating", "false");
        const before = await canvasPixels(page);
        await page.mouse.move(400, 300, { steps: 4 });
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(400);
        expect(await canvasPixels(page), `${path}: backdrop pixels`).toBe(before);
        await expect(canvas).toHaveAttribute("data-animating", "false");

        // Parallax is off: no layer has moved after scrolling.
        for (const layer of await parallaxTransforms(page)) {
          expect(layer).toEqual({ parallax: "off", inline: "", computed: "none" });
        }

        expect(await movingAnimations(page), `${path}: after scroll`).toEqual([]);
      });
    }
    expect(errors).toEqual([]);
  });

  test("home: no boot-up, CTA pulse or button press movement", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("hero-logo")).toHaveCSS("animation-name", "none");
    await expect(page.getByTestId("hero-logo")).toHaveCSS("opacity", "1");
    const cta = page.getByTestId("press-start");
    await expect(cta).toHaveCSS("animation-name", "none");

    // Hover, focus and press the primary CTA: its glow may change, but it never moves.
    await cta.hover();
    await cta.focus();
    const box = (await cta.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await movement(page, "press-start")).toEqual({ transform: "none", translate: "none" });
    expect(await movingAnimations(page)).toEqual([]);
    await page.mouse.up();
  });

  test("projects: cards neither tilt nor animate on hover and focus", async ({ page }) => {
    await page.goto("/projects");
    const tilt = page.getByTestId("tilt-card").first();
    const box = (await tilt.boundingBox())!;
    await page.mouse.move(box.x + box.width - 16, box.y + 16, { steps: 6 });
    await expect(tilt).toHaveAttribute("data-tilt", "off");
    expect(await movement(page, "tilt-card")).toEqual({ transform: "none", translate: "none" });
    await page.keyboard.press("Tab");
    expect(await movingAnimations(page)).toEqual([]);
    expect(await animatedStyles(page)).toEqual([]);
  });

  test("experience: opening a chapter neither reveals with motion nor animates the marker", async ({
    page,
  }) => {
    await page.goto("/experience");
    const chapter = page.getByTestId("quest-chapter").nth(1);
    await chapter.locator("summary").click();
    await expect(chapter.getByTestId("chapter-body")).toBeVisible();
    await expect(chapter.getByTestId("chapter-body")).toHaveCSS("animation-name", "none");
    expect(await movingAnimations(page)).toEqual([]);
    expect(await animatedStyles(page)).toEqual([]);
  });

  test("about: skill pips and the contact CTA stay still on hover and focus", async ({ page }) => {
    await page.goto("/about");
    // Tracing a skill path lights it without any animation or transition.
    const node = page.getByTestId("skill-node").first();
    await node.hover();
    await expect(node).toHaveAttribute("data-on-path", "true");
    await node.focus();
    expect(await movingAnimations(page)).toEqual([]);
    expect(await animatedStyles(page)).toEqual([]);
    const cta = page
      .getByRole("region", { name: "Join the party" })
      .getByRole("link", { name: "Email me" });
    await cta.scrollIntoViewIfNeeded();
    await cta.hover();
    await expect(cta).toHaveCSS("animation-name", "none");
    await cta.focus();
    await expect(cta).toHaveCSS("animation-name", "none");
    expect(await movingAnimations(page)).toEqual([]);
    expect(await animatedStyles(page)).toEqual([]);
  });

  test("nav and footer links do not animate on hover", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link").first().hover();
    expect(await movingAnimations(page)).toEqual([]);
    await page.getByRole("contentinfo").getByRole("link").first().hover();
    expect(await movingAnimations(page)).toEqual([]);
  });
});

test.describe("arcane backdrop", () => {
  for (const path of STATIC_PATHS) {
    test(`is behind the content on ${path}, decorative and click-through`, async ({ page }) => {
      await page.goto(path);
      const root = page.getByTestId("arcane-background");
      await expect(root).toHaveAttribute("aria-hidden", "true");
      await expect(root).toHaveCSS("position", "fixed");
      await expect(root).toHaveCSS("pointer-events", "none");
      await expect(root).toHaveCSS("z-index", "-10");
      await expect(page.getByTestId("arcane-canvas")).toBeVisible();
      // Whatever sits in the middle of the page is content, never the backdrop.
      const hit = await page.evaluate(() => {
        const element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return element?.closest("[data-testid='arcane-background']") !== null;
      });
      expect(hit).toBe(false);
      // No horizontal scrolling from the backdrop or parallax layers.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("animates when motion is allowed and pauses while the tab is hidden", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const canvas = page.getByTestId("arcane-canvas");
    await expect(canvas).toHaveAttribute("data-animating", "true");
    const first = await canvasPixels(page);
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).not.toBe(first);

    // Fake a hidden tab: the loop stops, and starts again once visible.
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await setVisibility("hidden");
    await expect(canvas).toHaveAttribute("data-animating", "false");
    const paused = await canvasPixels(page);
    await page.waitForTimeout(500);
    expect(await canvasPixels(page)).toBe(paused);
    await setVisibility("visible");
    await expect(canvas).toHaveAttribute("data-animating", "true");
  });

  test("hero rune circuit moves with a small parallax when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const layer = page.getByTestId("parallax-layer").first();
    await expect(layer).toHaveAttribute("data-parallax", "on");
    const offsetY = () =>
      layer.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42);
    const before = await offsetY();
    await page.mouse.wheel(0, 300);
    await expect.poll(offsetY).not.toBe(before);
    expect(Math.abs(await offsetY())).toBeLessThanOrEqual(16);
  });
});
