import { expect, test, type Page } from "@playwright/test";

/**
 * Command palette (#14): Ctrl+K / Cmd+K and the header button open the "Fast travel" dialog;
 * filtering, arrows and Enter navigate to a project; Escape, the backdrop and Close close it and
 * focus returns to the trigger; the header keeps one row of nav links with the button on the
 * name's row on phones; no horizontal scroll; no animation under reduced motion.
 */

/** Waits until the page has hydrated (the shortcut listener is attached after hydration). */
async function gotoHydrated(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** The palette dialog. */
function palette(page: Page) {
  return page.getByRole("dialog", { name: "Fast travel" });
}

/** The palette's combobox input. */
function combobox(page: Page) {
  return palette(page).getByRole("combobox");
}

test.describe("Command palette", () => {
  test("Ctrl+K opens it, typing filters and Enter opens the project page", async ({ page }) => {
    const projects: { slug: string; title: string }[] = await (
      await page.request.get("/api/projects")
    ).json();
    test.skip(projects.length === 0, "no projects in the data");
    const [project] = projects;

    await gotoHydrated(page, "/experience");
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();
    await expect(combobox(page)).toBeFocused();

    await combobox(page).fill(project.title);
    const first = palette(page).getByRole("option").first();
    await expect(first).toContainText(project.title);
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/projects/${project.slug}$`));
    await expect(palette(page)).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(project.title);
  });

  test("Meta+K opens it too, and arrows move the active option", async ({ page }) => {
    await gotoHydrated(page);
    await page.keyboard.press("Meta+k");
    await expect(palette(page)).toBeVisible();
    const options = palette(page).getByRole("option");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    const id = await options.nth(1).getAttribute("id");
    await expect(combobox(page)).toHaveAttribute("aria-activedescendant", id ?? "");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
  });

  test("the header button opens it; Escape closes it and focus returns", async ({ page }) => {
    await gotoHydrated(page, "/about");
    const button = page.getByRole("button", { name: "Fast travel" });
    await button.click();
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("a click on the backdrop and the Close button close it", async ({ page }) => {
    await gotoHydrated(page);
    const button = page.getByRole("button", { name: "Fast travel" });
    await button.click();
    await page.mouse.click(5, 5);
    await expect(palette(page)).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await palette(page).getByRole("button", { name: "Close" }).click();
    await expect(palette(page)).toBeHidden();
  });

  test("focus stays inside the open dialog", async ({ page }) => {
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    await expect(combobox(page)).toBeFocused();
    const presses = 6;
    let landedInside = 0;
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
      const where = await palette(page).evaluate((el) => {
        const active = document.activeElement;
        if (!active || active === document.body) return "none"; // browser UI between stops
        return el.contains(active) ? "inside" : "page";
      });
      expect(where, `press ${i + 1}: focus never reaches the page behind`).not.toBe("page");
      if (where === "inside") landedInside += 1;
    }
    // Not vacuous: the dialog's controls (input, Close) actually received focus.
    expect(landedInside).toBeGreaterThanOrEqual(presses / 2);
  });

  test("the Contact command goes to the contact section", async ({ page }) => {
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    await combobox(page).fill("contact");
    await palette(page)
      .getByRole("option", { name: /^Contact/ })
      .click();
    await expect(page).toHaveURL(/\/about#contact$/);
  });

  test("Ctrl+K inside another input does not open it", async ({ page }) => {
    await gotoHydrated(page);
    await page.evaluate(() => {
      const field = document.createElement("input");
      field.setAttribute("aria-label", "Injected field");
      document.body.prepend(field);
    });
    const field = page.getByRole("textbox", { name: "Injected field" });
    await field.focus();
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeHidden();
    await expect(field).toBeFocused();
  });

  test("plain K and Ctrl+Shift+K do not open it", async ({ page }) => {
    await gotoHydrated(page);
    await page.keyboard.press("k");
    await page.keyboard.press("Control+Shift+K");
    await expect(palette(page)).toBeHidden();
  });

  for (const width of [320, 375]) {
    test(`at ${width} px the button shares the name's row and nav links stay on one row`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoHydrated(page, "/projects");
      const nav = page.getByRole("navigation", { name: "Main" });
      const links = await nav.getByRole("link").all();
      const [home, ...sections] = await Promise.all(links.map((link) => link.boundingBox()));
      const button = await nav.getByRole("button", { name: "Fast travel" }).boundingBox();
      const middle = (box: typeof button) => (box ? box.y + box.height / 2 : NaN);

      expect(Math.abs(middle(button) - middle(home)), "button on the name's row").toBeLessThan(4);
      expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(button?.width ?? 0).toBeGreaterThanOrEqual(44);
      for (const box of sections) {
        expect(Math.abs(middle(box) - middle(sections[0])), "links on one row").toBeLessThan(2);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // Two rows only: the links sit below the name row.
      expect(middle(sections[0])).toBeGreaterThan(middle(home) + 30);
      await expect(nav.getByRole("button", { name: "Fast travel" })).toBeInViewport({ ratio: 1 });
    });
  }

  for (const width of [375, 768, 1280]) {
    test(`no horizontal scroll with the palette open at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoHydrated(page);
      await page.getByRole("button", { name: "Fast travel" }).click();
      await expect(palette(page)).toBeInViewport({ ratio: 1 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("at 1280 px the button sits at the right end of the one-row bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoHydrated(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    const lastLink = await nav.getByRole("link", { name: "Contact" }).boundingBox();
    const button = await nav.getByRole("button", { name: "Fast travel" }).boundingBox();
    expect((button?.x ?? 0) > (lastLink?.x ?? 0) + (lastLink?.width ?? 0)).toBe(true);
    expect(Math.abs((button?.y ?? 0) - (lastLink?.y ?? 0))).toBeLessThan(4);
    await expect(nav.getByRole("button", { name: "Fast travel" })).toContainText("Ctrl K");
  });

  test("under reduced motion opening runs no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();
    const styles = await palette(page).evaluate((el) => {
      const style = getComputedStyle(el);
      return { animation: style.animationName, transform: style.transform };
    });
    expect(styles.animation).toBe("none");
    expect(styles.transform).toBe("none");
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" || a.pending)
          .filter((a) => Number(a.effect?.getComputedTiming().activeDuration ?? 0) > 0.011).length,
    );
    expect(running).toBe(0);
  });

  test("with motion allowed the dialog fades in", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    const animation = await palette(page).evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("palette-in");
  });

  test("Ctrl+K from a focused link returns focus to that link on Escape", async ({ page }) => {
    await gotoHydrated(page, "/about");
    const link = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Projects" });
    await link.focus();
    await page.keyboard.press("Control+k");
    await expect(combobox(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("the secret arrow-key input still works after the palette was opened and closed", async ({
    page,
  }) => {
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    for (const key of [
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
    ]) {
      await page.keyboard.press(key);
    }
    await expect(page.getByTestId("easter-egg-toast")).toBeVisible();
  });

  test("Escape over open toasts closes only the palette", async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem(
        "mochkai:collectibles:v1",
        JSON.stringify(["title-screen", "quest-board", "quest-loot", "quest-log-end"]),
      ),
    );
    await gotoHydrated(page, "/about");
    await page.getByRole("button", { name: "Collect rune shard 5 of 5" }).click();
    await expect(page.getByTestId("achievement-toast")).toBeVisible();
    for (const key of [
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
    ]) {
      await page.keyboard.press(key);
    }
    await expect(page.getByTestId("easter-egg-toast")).toBeVisible();
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "true");

    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(page.getByTestId("achievement-toast")).toBeVisible();
    await expect(page.getByTestId("easter-egg-toast")).toBeVisible();
    await expect(page.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "true");
  });

  test("dragging from the input out to the backdrop keeps it open", async ({ page }) => {
    await gotoHydrated(page);
    await page.keyboard.press("Control+k");
    await combobox(page).fill("project");
    const box = await combobox(page).boundingBox();
    if (!box) throw new Error("no combobox box");
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 4 });
    await page.mouse.move(5, 5, { steps: 4 });
    await page.mouse.up();
    await expect(palette(page)).toBeVisible();
    await expect(combobox(page)).toHaveValue("project");
    // A real click on the backdrop still closes it.
    await page.mouse.click(5, 5);
    await expect(palette(page)).toBeHidden();
  });
});

/** Must match `PROGRESS_STORAGE_KEY` in `src/lib/collectible-progress.ts`. */
const SHARDS_KEY = "mochkai:collectibles:v1";

/** Header measurements: height, logo size, and the name span's client and scroll widths. */
async function measureHeader(page: Page) {
  const header = page.getByRole("banner");
  const home = header.getByRole("navigation", { name: "Main" }).getByRole("link").first();
  const logo = await home.locator("img").boundingBox();
  const name = await home
    .locator("span")
    .first()
    .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  return { height: (await header.boundingBox())?.height ?? 0, logo, name };
}

test.describe("Header room for the palette button", () => {
  for (const width of [320, 375, 640, 700, 768]) {
    test(`at ${width} px the header keeps its height and the name stays readable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoHydrated(page, "/projects");
      const empty = await measureHeader(page);

      await page.evaluate(
        ([key, value]) => window.localStorage.setItem(key, value),
        [SHARDS_KEY, JSON.stringify(["title-screen", "quest-board"])],
      );
      await gotoHydrated(page, "/projects");
      await expect(page.getByTestId("collectible-counter")).toBeVisible();
      const found = await measureHeader(page);

      for (const [label, m] of [
        ["0 shards", empty],
        ["2 shards", found],
      ] as const) {
        expect(m.logo?.width, `${label}: logo width`).toBeCloseTo(32, 0);
        expect(m.logo?.height, `${label}: logo height`).toBeCloseTo(32, 0);
        expect(m.name.client, `${label}: name width`).toBeGreaterThanOrEqual(40);
        // Depends on the profile name's length: the fixture name ("Your Name") fits at 768 px
        // next to two shards; a much longer real name may legitimately truncate here.
        if (width >= 768) {
          expect(m.name.scroll, `${label}: name not truncated`).toBeLessThanOrEqual(m.name.client);
        }
      }
      expect(found.height, "header height unchanged by the counter").toBeCloseTo(empty.height, 0);
      // Two rows on phones (name row, links row), one row from 640 px.
      expect(empty.height).toBeLessThan(width < 640 ? 130 : 80);

      const nav = page.getByRole("navigation", { name: "Main" });
      const button = nav.getByRole("button", { name: "Fast travel" });
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      for (const link of await nav.getByRole("link").all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
      }
    });
  }
});
