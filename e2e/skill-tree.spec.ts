import { expect, test, type Page } from "@playwright/test";

/** The skill tree's `Skills` section on About. */
function skills(page: Page) {
  return page.getByRole("region", { name: "Skills" });
}

/** Escapes RegExp metacharacters so `text` matches literally inside a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A skill node button by its skill name. */
function skillNode(page: Page, name: string) {
  return skills(page).getByRole("button", { name: new RegExp(`^${escapeRegExp(name)},`) });
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

test.describe("skill tree", () => {
  test("is server-rendered with every node and connector", async ({ request }) => {
    const html = await (await request.get("/about")).text();
    const profile: { skillTree: { skills: { requires?: string[] }[] }[] } = await (
      await request.get("/api/profile")
    ).json();
    const skillCount = profile.skillTree.reduce((n, branch) => n + branch.skills.length, 0);
    const edgeCount = profile.skillTree
      .flatMap((branch) => branch.skills)
      .reduce((n, skill) => n + Math.max(1, skill.requires?.length ?? 0), 0);
    expect(html.match(/data-testid="skill-node"/g)).toHaveLength(skillCount);
    expect(html.match(/data-testid="skill-edge"/g)).toHaveLength(edgeCount);
    expect(html.match(/data-testid="skill-branch"/g)).toHaveLength(profile.skillTree.length);
  });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("shows every branch side by side without scrolling", async ({ page }) => {
      await page.goto("/about");
      const branches = skills(page).getByTestId("skill-branch");
      await expect(branches).toHaveCount(4);
      await expect(skills(page).getByRole("tablist")).toBeHidden();
      const boxes = await branches.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect()),
      );
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right - 1);
        expect(Math.abs(boxes[i].top - boxes[0].top)).toBeLessThan(1);
      }
      const scroll = await skills(page)
        .getByTestId("skill-tree-scroll")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(scroll).toBeLessThanOrEqual(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      for (const name of ["Front end", "Back end", "DevOps", "AI dev"]) {
        await expect(skills(page).getByRole("region", { name })).toBeVisible();
      }
    });

    test("hover lights the path to the root and the details panel follows a click", async ({
      page,
    }) => {
      await page.goto("/about");
      await skillNode(page, "Next.js").hover();
      for (const name of ["Next.js", "React", "TypeScript", "JavaScript", "HTML & CSS"]) {
        await expect(skillNode(page, name)).toHaveAttribute("data-on-path", "true");
      }
      await expect(skillNode(page, "Tailwind CSS")).toHaveAttribute("data-on-path", "false");
      expect(await litEdgeCount(page)).toBe(5);

      await skillNode(page, "REST APIs").click();
      await expect(skillNode(page, "Python")).toHaveAttribute("data-on-path", "true");
      await expect(skillNode(page, "Node.js")).toHaveAttribute("data-on-path", "true");
      const details = skills(page).getByTestId("skill-details");
      await expect(details).not.toHaveAttribute("aria-live");
      const status = skills(page).getByTestId("skill-details-status");
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveText(/^(Used in \d+ quests?|No quests yet)$/);
      await expect(details).toContainText("REST APIs");
      await expect(details).toContainText("Requires Python and Node.js");
      await expect(skillNode(page, "REST APIs")).toHaveAccessibleName(
        "REST APIs, Mastered, requires Python and Node.js",
      );
    });

    test("keyboard focus lights the same path as hover", async ({ page }) => {
      await page.goto("/about");
      await skillNode(page, "HTML & CSS").focus();
      await page.keyboard.press("ArrowDown");
      await expect(skillNode(page, "JavaScript")).toBeFocused();
      await expect(skillNode(page, "HTML & CSS")).toHaveAttribute("data-on-path", "true");
      expect(await litEdgeCount(page)).toBe(2);
      await expect(skills(page).getByTestId("skill-details")).toContainText("JavaScript");
    });

    test("marks the currently learning skill as Learning", async ({ page }) => {
      await page.goto("/about");
      await expect(skillNode(page, "LangGraph")).toHaveAccessibleName(/^LangGraph, Learning/);
    });
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 375, height: 800 }, hasTouch: true });

    test("shows one branch at a time, chosen with tabs", async ({ page }) => {
      await page.goto("/about");
      const tablist = skills(page).getByRole("tablist", { name: "Skill branches" });
      await expect(tablist).toBeVisible();
      const tabs = tablist.getByRole("tab");
      await expect(tabs).toHaveText(["Front end", "Back end", "DevOps", "AI dev"]);
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
      await expect(skills(page).getByRole("tabpanel")).toHaveCount(1);
      await expect(skillNode(page, "React")).toBeVisible();
      await expect(skillNode(page, "Python")).toBeHidden();

      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await expect(skills(page).getByRole("tabpanel")).toHaveAccessibleName("Back end");
      await expect(skillNode(page, "Python")).toBeVisible();
      await expect(skillNode(page, "React")).toBeHidden();

      await tabs.nth(1).focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(2)).toBeFocused();
      await expect(skillNode(page, "Docker")).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test("a tap lights the path and fills the details panel", async ({ page }) => {
      await page.goto("/about");
      await skillNode(page, "Next.js").tap();
      await expect(skillNode(page, "HTML & CSS")).toHaveAttribute("data-on-path", "true");
      const details = skills(page).getByTestId("skill-details");
      await expect(details).toContainText("Next.js");
      await expect(details.getByRole("link")).toHaveAttribute("href", "/projects?tech=Next.js");
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  });

  test.describe("reduced motion", () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("the highlight still appears, without animation", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/about");
      const node = skillNode(page, "React");
      await node.hover();
      await expect(node).toHaveAttribute("data-on-path", "true");
      const path = skills(page).getByTestId("skill-path");
      await expect(path).toHaveCount(1);
      await expect(path).toHaveCSS("animation-name", "none");
      await expect(path).toHaveCSS("opacity", "1");
      // Only the reduced-motion baseline (0.01 ms) is left of any transition.
      const longest = await node.evaluate((el) =>
        Math.max(
          ...getComputedStyle(el)
            .transitionDuration.split(",")
            .map((t) => parseFloat(t) * (t.trim().endsWith("ms") ? 1 : 1000)),
        ),
      );
      expect(longest).toBeLessThanOrEqual(0.011);
      await node.focus();
      await expect(node).toHaveAttribute("data-selected", "true");
      await expect(skills(page).getByTestId("skill-path")).toHaveCSS("animation-name", "none");
    });
  });

  test("the lit path powers up when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/about");
    await skillNode(page, "React").hover();
    const path = skills(page).getByTestId("skill-path");
    await expect(path).toHaveCSS("animation-name", "path-charge");
    // The glow lives on the wrapper, so the charge's filter never hides it.
    const wrapperFilter = await path.evaluate(
      (el) => getComputedStyle(el.parentElement as Element).filter,
    );
    expect(wrapperFilter).toContain("drop-shadow");
  });
});
