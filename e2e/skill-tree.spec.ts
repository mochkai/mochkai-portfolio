import { expect, test, type Locator, type Page } from "@playwright/test";

/** The skill map's `Skills` section on About. */
function skills(page: Page) {
  return page.getByRole("region", { name: "Skills" });
}

/** Escapes RegExp metacharacters so `text` matches literally inside a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A skill node by its skill name. */
function skillNode(page: Page, name: string) {
  return skills(page).getByRole("button", { name: new RegExp(`^${escapeRegExp(name)},`) });
}

/** The map SVG. */
function map(page: Page) {
  return page.getByTestId("skill-map");
}

/** The map's current viewBox. */
function viewBox(page: Page) {
  return map(page).evaluate((svg) => svg.getAttribute("viewBox") ?? "");
}

/** Width of the current viewBox in map units (smaller is more zoomed in). */
async function viewWidth(page: Page) {
  return Number((await viewBox(page)).split(" ")[2]);
}

/** Waits until the client has measured the frame and set a live view (not the server box). */
async function waitForLiveView(page: Page) {
  const surface = page.getByTestId("skill-map-surface");
  await expect(surface).toBeVisible();
  await expect
    .poll(async () => {
      const [frame, box] = await Promise.all([
        surface.evaluate((el) => el.getBoundingClientRect()),
        viewBox(page),
      ]);
      const [, , width, height] = box.split(" ").map(Number);
      // A live view has the frame's aspect ratio.
      return Math.abs(width / height - frame.width / frame.height) < 0.01;
    })
    .toBe(true);
}

/** Waits until the view stops moving (a released drag may glide when motion is allowed). */
async function waitForStill(page: Page) {
  await expect
    .poll(async () => {
      const before = await viewBox(page);
      await page.waitForTimeout(150);
      return (await viewBox(page)) === before;
    })
    .toBe(true);
}

/** How many connectors are lit right now. */
function litEdgeCount(page: Page) {
  return skills(page).locator('[data-testid="skill-edge"][data-lit="true"]').count();
}

/** Horizontal overflow of the whole page, in px (0 when nothing scrolls sideways). */
function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Rendered font size of every skill label, in CSS px, with its text. */
function labelSizes(page: Page) {
  return page.getByTestId("skill-name").evaluateAll((labels) =>
    labels.map((label) => {
      const text = label as SVGTextElement;
      const scale = text.ownerSVGElement?.getScreenCTM()?.a ?? 0;
      return { name: text.textContent, px: parseFloat(getComputedStyle(text).fontSize) * scale };
    }),
  );
}

/** Skill names whose box is not fully inside the map frame. */
function namesOutsideFrame(page: Page) {
  return page.evaluate(() => {
    const frame = document
      .querySelector('[data-testid="skill-map-frame"]')!
      .getBoundingClientRect();
    return Array.from(document.querySelectorAll('[data-testid="skill-name"]'))
      .filter((label) => {
        const box = label.getBoundingClientRect();
        return (
          box.left < frame.left ||
          box.right > frame.right ||
          box.top < frame.top ||
          box.bottom > frame.bottom
        );
      })
      .map((label) => label.textContent);
  });
}

/** Whether a node's centre is inside the map frame. */
async function inFrame(page: Page, node: Locator) {
  const [frame, box] = await Promise.all([
    page.getByTestId("skill-map-frame").boundingBox(),
    node.locator("circle").last().boundingBox(),
  ]);
  if (!frame || !box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  return x > frame.x && x < frame.x + frame.width && y > frame.y && y < frame.y + frame.height;
}

/** Drags with the mouse from the centre of `from` by (dx, dy), in steps. */
async function mouseDrag(page: Page, from: Locator, dx: number, dy: number) {
  const box = await from.boundingBox();
  if (!box) throw new Error("nothing to drag");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

/** A one-finger touch drag through the Chrome DevTools protocol (real touch input). */
async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/**
 * A two-finger pinch through the Chrome DevTools protocol: both fingers go down `from` px apart
 * around (x, y), spread (or close) horizontally to `to` px apart in steps, and lift. With
 * `dragFirst`, the first finger drags a little before the second one lands.
 */
async function touchPinch(
  page: Page,
  x: number,
  y: number,
  from: number,
  to: number,
  { dragFirst = false } = {},
) {
  const cdp = await page.context().newCDPSession(page);
  /** The two finger positions at a given spread. */
  const fingers = (spread: number) => [
    { id: 1, x: x - spread / 2, y },
    { id: 2, x: x + spread / 2, y },
  ];
  // One finger first, then the second, as a person does.
  const [first] = fingers(from);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  if (dragFirst) {
    // The first finger drags past the threshold (the surface takes its capture over from the
    // node under it) and comes back, before the second finger lands.
    for (const dx of [10, 20, 10, 0]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...first, x: first.x + dx }],
      });
    }
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(from) });
  for (let step = 1; step <= 10; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: fingers(from + ((to - from) * step) / 10),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** The current view: viewBox origin and width, and CSS px per map unit. */
async function viewState(page: Page) {
  const [x, y, width] = (await viewBox(page)).split(" ").map(Number);
  const frame = (await page.getByTestId("skill-map-surface").boundingBox())!;
  return { x, y, width, scale: frame.width / width };
}

test.describe("skill map", () => {
  test("is server-rendered: every node and connector, Constellation, fitted viewBox", async ({
    request,
  }) => {
    const html = await (await request.get("/about")).text();
    const profile: { skillTree: { skills: { requires?: string[] }[] }[] } = await (
      await request.get("/api/profile")
    ).json();
    const skillCount = profile.skillTree.reduce((n, branch) => n + branch.skills.length, 0);
    const edgeCount =
      profile.skillTree.length +
      profile.skillTree
        .flatMap((branch) => branch.skills)
        .reduce((n, skill) => n + Math.max(1, skill.requires?.length ?? 0), 0);
    expect(html.match(/data-testid="skill-node"/g)).toHaveLength(skillCount);
    expect(html.match(/data-testid="skill-hub"/g)).toHaveLength(profile.skillTree.length);
    expect(html.match(/data-testid="skill-start"/g)).toHaveLength(1);
    expect(html.match(/data-testid="skill-edge"/g)).toHaveLength(edgeCount);
    expect(html).toMatch(/data-testid="skill-map" data-layout="constellation" viewBox="[-\d. ]+"/);
  });

  for (const { width, height, beside } of [
    { width: 1024, height: 800, beside: false },
    { width: 1280, height: 900, beside: true },
  ]) {
    for (const layout of ["constellation", "tree"] as const) {
      test(`opens on the whole ${layout} map with every name readable at ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript(
          (value) => localStorage.setItem("mochkai:skill-map-layout:v1", value),
          layout,
        );
        await page.goto("/about");
        await expect(map(page)).toHaveAttribute("data-layout", layout);
        await waitForLiveView(page);
        const sizes = await labelSizes(page);
        expect(sizes.length).toBeGreaterThan(10);
        for (const { name, px } of sizes) expect(px, name ?? "").toBeGreaterThanOrEqual(10);
        expect(await namesOutsideFrame(page)).toEqual([]);
        // The details panel sits beside the map from 1280 px and below it under that.
        const [frame, details] = await Promise.all([
          page.getByTestId("skill-map-frame").boundingBox(),
          skills(page).getByTestId("skill-details").boundingBox(),
        ]);
        if (beside) expect(details!.x).toBeGreaterThan(frame!.x + frame!.width);
        else expect(details!.y).toBeGreaterThan(frame!.y + frame!.height);
        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("hover lights the path to the start node and a click fills the details", async ({
      page,
    }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      await skillNode(page, "Next.js").hover();
      for (const name of ["Next.js", "React", "TypeScript", "JavaScript", "HTML & CSS"]) {
        await expect(skillNode(page, name)).toHaveAttribute("data-on-path", "true");
      }
      await expect(skillNode(page, "Tailwind CSS")).toHaveAttribute("data-on-path", "false");
      await expect(skills(page).getByRole("button", { name: /^Start,/ })).toHaveAttribute(
        "data-on-path",
        "true",
      );
      // Start -> hub -> HTML & CSS -> JavaScript -> TypeScript -> React -> Next.js.
      expect(await litEdgeCount(page)).toBe(6);

      await skillNode(page, "REST APIs").click();
      await expect(skillNode(page, "REST APIs")).toHaveAttribute("data-selected", "true");
      const details = skills(page).getByTestId("skill-details");
      await expect(details).not.toHaveAttribute("aria-live");
      await expect(details).toContainText("Builds on Python and Node.js");
      const status = skills(page).getByTestId("skill-details-status");
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveText(/^(Used in \d+ quests?|No quests yet)$/);
      await expect(skillNode(page, "REST APIs")).toHaveAccessibleName(
        "REST APIs, Mastered, requires Python and Node.js",
      );
    });

    test("an Unlocks chip selects that skill and pans to it", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      await skillNode(page, "React").focus();
      // Zoom in on the start node, so Next.js (far out on the Front end branch) is off screen.
      await page.getByRole("button", { name: "Centre" }).click();
      for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in" }).click();
      await expect.poll(() => inFrame(page, skillNode(page, "Next.js"))).toBe(false);
      const details = skills(page).getByTestId("skill-details");
      await details.getByRole("button", { name: "Next.js" }).click();
      await expect(skillNode(page, "Next.js")).toHaveAttribute("data-selected", "true");
      await expect(skillNode(page, "Next.js")).toBeFocused();
      await expect.poll(() => inFrame(page, skillNode(page, "Next.js"))).toBe(true);
    });

    test("drag pans the map and never selects the node it started on", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      await page.getByRole("button", { name: "Zoom in" }).click();
      const before = await viewBox(page);
      await mouseDrag(page, skillNode(page, "Python"), -120, 80);
      await expect.poll(() => viewBox(page)).not.toBe(before);
      await expect(skills(page).locator('[data-selected="true"]')).toHaveCount(0);
      await expect(skills(page).getByTestId("skill-details")).toContainText(
        "Hover, tap or focus a skill",
      );
      // A press without movement still selects.
      await waitForStill(page);
      await skillNode(page, "Python").click();
      await expect(skillNode(page, "Python")).toHaveAttribute("data-selected", "true");
    });

    test("zoom buttons, Full view and Centre", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const initial = await viewWidth(page);
      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect.poll(() => viewWidth(page)).toBeLessThan(initial * 0.8);
      await page.getByRole("button", { name: "Full view" }).click();
      await expect.poll(() => viewWidth(page)).toBeCloseTo(initial, 0);
      for (const name of ["Next.js", "LangGraph", "PostgreSQL", "Playwright"]) {
        expect(await inFrame(page, skillNode(page, name)), name).toBe(true);
      }
      await page.getByRole("button", { name: "Zoom out" }).click();
      await expect.poll(() => viewWidth(page)).toBeGreaterThan(initial);
      await page.getByRole("button", { name: "Centre" }).click();
      await expect.poll(() => viewWidth(page)).toBeCloseTo(initial, 0);
    });

    test("Ctrl + wheel zooms the map; a plain wheel scrolls the page", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const frame = page.getByTestId("skill-map-frame");
      await frame.scrollIntoViewIfNeeded();
      const box = (await frame.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const initial = await viewWidth(page);
      const scrollY = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 200);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY);
      expect(await viewWidth(page)).toBe(initial);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -200);
      await page.keyboard.up("Control");
      await expect.poll(() => viewWidth(page)).toBeLessThan(initial);
    });

    test("keyboard: Tab reaches the start node, arrows pan focus into view, + − 0 zoom", async ({
      page,
    }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const start = skills(page).getByRole("button", { name: /^Start,/ });
      for (
        let i = 0;
        i < 60 && !(await start.evaluate((el) => el === document.activeElement));
        i++
      ) {
        await page.keyboard.press("Tab");
      }
      await expect(start).toBeFocused();
      // A visible focus ring (not the browser outline, which an SVG group would draw square).
      await expect(start.getByTestId("node-focus-ring")).toHaveCSS("opacity", "1");
      const initial = await viewWidth(page);
      await page.keyboard.press("+");
      await page.keyboard.press("+");
      await expect.poll(() => viewWidth(page)).toBeLessThan(initial * 0.6);
      // Next.js is far out on the Front end branch: arrowing to it pans it into view.
      await page.keyboard.press("ArrowDown");
      for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
      await expect(skillNode(page, "Next.js")).toBeFocused();
      await expect(skillNode(page, "Next.js")).toHaveAttribute("data-selected", "true");
      await expect.poll(() => inFrame(page, skillNode(page, "Next.js"))).toBe(true);
      await page.keyboard.press("-");
      await page.keyboard.press("0");
      await expect.poll(() => viewWidth(page)).toBeCloseTo(initial, 0);
    });

    test("switching layouts is remembered across a reload", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const layout = skills(page).getByRole("group", { name: "Map layout" });
      await expect(layout.getByRole("button", { name: "Constellation" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await layout.getByRole("button", { name: "World tree" }).click();
      await expect(map(page)).toHaveAttribute("data-layout", "tree");
      await page.reload();
      await expect(map(page)).toHaveAttribute("data-layout", "tree");
      await expect(layout.getByRole("button", { name: "World tree" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await waitForLiveView(page);
      for (const { name, px } of await labelSizes(page)) {
        expect(px, name ?? "").toBeGreaterThanOrEqual(9.9);
      }
      await layout.getByRole("button", { name: "Constellation" }).click();
      await expect(map(page)).toHaveAttribute("data-layout", "constellation");
      await page.reload();
      await expect(map(page)).toHaveAttribute("data-layout", "constellation");
    });
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });

    test("opens zoomed to a readable scale, centred on the start node", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      for (const { name, px } of await labelSizes(page)) {
        expect(px, name ?? "").toBeGreaterThanOrEqual(9.9);
      }
      const names = await page.getByTestId("skill-name").all();
      for (const name of names) await expect(name).toBeVisible();
      // No control sits over the map, so a name inside the frame is never covered.
      const frameBox = (await page.getByTestId("skill-map-frame").boundingBox())!;
      for (const control of await skills(page)
        .getByRole("group", { name: "Map view" })
        .getByRole("button")
        .all()) {
        const box = (await control.boundingBox())!;
        const overlaps =
          box.x < frameBox.x + frameBox.width &&
          frameBox.x < box.x + box.width &&
          box.y < frameBox.y + frameBox.height &&
          frameBox.y < box.y + box.height;
        expect(
          overlaps,
          (await control.getAttribute("aria-label")) ?? (await control.textContent()) ?? "",
        ).toBe(false);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const [frame, start] = await Promise.all([
        page.getByTestId("skill-map-frame").boundingBox(),
        skills(page)
          .getByRole("button", { name: /^Start,/ })
          .boundingBox(),
      ]);
      expect(Math.abs(start!.x + start!.width / 2 - (frame!.x + frame!.width / 2))).toBeLessThan(4);
      // The frame is about 70 % of the viewport tall; the details panel sits below it.
      expect(frame!.height).toBeGreaterThan(500);
      expect(frame!.height).toBeLessThanOrEqual(0.7 * 800 + 1);
      const details = await skills(page).getByTestId("skill-details").boundingBox();
      expect(details!.y).toBeGreaterThan(frame!.y + frame!.height);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test("a one-finger drag pans without selecting; a tap selects", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const frame = page.getByTestId("skill-map-frame");
      await frame.scrollIntoViewIfNeeded();
      const before = await viewBox(page);
      const python = (await skillNode(page, "Python").boundingBox())!;
      await touchDrag(page, python.x + python.width / 2, python.y + python.height / 2, -60, 90);
      await expect.poll(() => viewBox(page)).not.toBe(before);
      await expect(skills(page).locator('[data-selected="true"]')).toHaveCount(0);
      await waitForStill(page);
      await skillNode(page, "Python").tap();
      await expect(skillNode(page, "Python")).toHaveAttribute("data-selected", "true");
      await expect(skills(page).getByTestId("skill-details")).toContainText("Python");
    });

    test("a multi-step touch drag keeps panning with the finger all the way", async ({ page }) => {
      // No glide, so the map ends exactly where the finger does.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/about");
      await waitForLiveView(page);
      await page.getByTestId("skill-map-frame").scrollIntoViewIfNeeded();
      const before = await viewState(page);
      // Start on a node: Chrome implicitly captures the touch to it, and the surface must keep
      // the gesture when it takes that capture over past the drag threshold.
      const node = (await skillNode(page, "Node.js").boundingBox())!;
      await touchDrag(page, node.x + node.width / 2, node.y + node.height / 2, 120, 0);
      const after = await viewState(page);
      const moved = (before.x - after.x) * before.scale;
      expect(moved).toBeGreaterThan(120 * 0.85);
      expect(moved).toBeLessThan(120 * 1.15);
      expect(after.width).toBeCloseTo(before.width, 0);
      await expect(skills(page).locator('[data-selected="true"]')).toHaveCount(0);
    });

    test("a two-finger pinch zooms the map", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/about");
      await waitForLiveView(page);
      const frame = page.getByTestId("skill-map-frame");
      await frame.scrollIntoViewIfNeeded();
      const box = (await frame.boundingBox())!;
      const before = await viewState(page);
      await touchPinch(page, box.x + box.width / 2, box.y + box.height / 2, 60, 200);
      const zoomedIn = await viewState(page);
      // Fingers 60 -> 200 px apart: a 3.3x spread, capped by the zoom limit (about 3.1x here).
      const limit = Math.min(200 / 60, 2.5 / before.scale);
      expect(before.width / zoomedIn.width).toBeGreaterThan(limit * 0.85);
      await touchPinch(page, box.x + box.width / 2, box.y + box.height / 2, 200, 70);
      expect((await viewState(page)).width).toBeGreaterThan(zoomedIn.width * 1.8);
      await expect(skills(page).locator('[data-selected="true"]')).toHaveCount(0);
    });

    test("a pinch that starts after a one-finger drag still zooms", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/about");
      await waitForLiveView(page);
      const frame = page.getByTestId("skill-map-frame");
      await frame.scrollIntoViewIfNeeded();
      const box = (await frame.boundingBox())!;
      const before = await viewState(page);
      await touchPinch(page, box.x + box.width / 2, box.y + box.height / 2, 60, 200, {
        dragFirst: true,
      });
      const limit = Math.min(200 / 60, 2.5 / before.scale);
      expect(before.width / (await viewState(page)).width).toBeGreaterThan(limit * 0.85);
    });

    test("the page still scrolls when touching outside the map", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      await expect(page.getByTestId("skill-map-surface")).toHaveCSS("touch-action", "none");
      const heading = page.getByRole("heading", { level: 2, name: "Skills" });
      await heading.scrollIntoViewIfNeeded();
      const box = (await heading.boundingBox())!;
      const scrollY = await page.evaluate(() => window.scrollY);
      await touchDrag(page, box.x + 20, box.y + box.height / 2, 0, -200);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY + 50);
    });

    test("a details chip scrolls the map back into view and selects its skill", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/about");
      await waitForLiveView(page);
      await skillNode(page, "Python").tap();
      const details = skills(page).getByTestId("skill-details");
      const chip = details.getByRole("button", { name: "FastAPI" });
      await chip.scrollIntoViewIfNeeded();
      // The panel is below the map: once the chip is on screen, the map's top is not.
      const frame = page.getByTestId("skill-map-frame");
      expect((await frame.boundingBox())!.y).toBeLessThan(0);
      await chip.tap();
      await expect(skillNode(page, "FastAPI")).toHaveAttribute("data-selected", "true");
      await expect.poll(async () => (await frame.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
      await expect.poll(() => inFrame(page, skillNode(page, "FastAPI"))).toBe(true);
    });

    test("Full view fits the whole map in the frame", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      await page.getByRole("button", { name: "Full view" }).click();
      for (const name of ["Next.js", "LangGraph", "PostgreSQL", "Playwright"]) {
        await expect.poll(() => inFrame(page, skillNode(page, name)), name).toBe(true);
      }
    });
  });

  test.describe("reduced motion", () => {
    test.use({ viewport: { width: 1280, height: 900 } });
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("zooms are instant, drags do not glide and the lit path is still", async ({ page }) => {
      await page.goto("/about");
      await waitForLiveView(page);
      const initial = await viewWidth(page);
      await page.getByRole("button", { name: "Zoom in" }).click();
      // No animation frames: the very next read is the final view.
      expect(await viewWidth(page)).toBeLessThan(initial * 0.8);
      await mouseDrag(page, page.getByTestId("skill-map-surface"), -200, 0);
      const released = await viewBox(page);
      await page.waitForTimeout(300);
      expect(await viewBox(page)).toBe(released);

      const node = skillNode(page, "React");
      await page.getByRole("button", { name: "Full view" }).click();
      await node.hover();
      await expect(node).toHaveAttribute("data-on-path", "true");
      const path = skills(page).getByTestId("skill-path");
      await expect(path).toHaveCSS("animation-name", "none");
      await expect(path).toHaveCSS("opacity", "1");
      await expect(skills(page).getByTestId("skill-flow").first()).toHaveCSS(
        "animation-name",
        "none",
      );
      const running = await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" &&
                Number(animation.effect?.getComputedTiming().activeDuration ?? 0) > 0.011,
            ).length,
      );
      expect(running).toBe(0);
    });
  });

  test("the lit path powers up and flows when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/about");
    await waitForLiveView(page);
    await skillNode(page, "React").hover();
    const path = skills(page).getByTestId("skill-path");
    await expect(path).toHaveCSS("animation-name", "path-charge");
    await expect(skills(page).getByTestId("skill-flow").first()).toHaveCSS(
      "animation-name",
      "skill-flow",
    );
    // The glow lives on the wrapper, so the charge's filter never hides it.
    const wrapperFilter = await path.evaluate(
      (el) => getComputedStyle(el.parentElement as Element).filter,
    );
    expect(wrapperFilter).toContain("drop-shadow");
  });
});
