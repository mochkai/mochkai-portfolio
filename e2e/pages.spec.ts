import { expect, test, type Page } from "@playwright/test";

/** The `Main` navigation landmark in the site header. */
function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

/** The not-found page's `<h1>` in server-rendered HTML. */
const NOT_FOUND_HEADING = /<h1[^>]*>Page not found<\/h1>/;

/** Escapes text the way React does when it server-renders a text node. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Escapes RegExp metacharacters so `text` matches literally inside a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches an `<h1>` (with any attributes) whose content is exactly `text`, HTML-escaped. */
function h1WithText(text: string): RegExp {
  return new RegExp(`<h1[^>]*>${escapeRegExp(escapeHtml(text))}</h1>`);
}

test.describe("pages", () => {
  test("home shows the profile and featured projects", async ({ page, request }) => {
    const featured: { title: string }[] = await (
      await request.get("/api/projects?featured=true")
    ).json();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const section = page.getByRole("region", { name: "Featured projects" });
    await expect(section.getByRole("heading", { level: 3 })).toHaveText(
      featured.map((p) => p.title),
    );
  });

  test("home is a title screen with a Press Start CTA, scoreboard and no dates", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.getByRole("region", { name: await page.locator("h1").innerText() });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(hero.getByText(/^Player 1 · /)).toBeVisible();
    await expect(hero.getByTestId("hero-logo")).toBeVisible();
    await expect(hero.getByRole("link", { name: "Press Start: view projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    await expect(hero.getByRole("link", { name: "Read experience" })).toHaveAttribute(
      "href",
      "/experience",
    );
    await expect(hero.getByRole("link", { name: "About me" })).toHaveAttribute("href", "/about");
    await expect(page.getByLabel("Player stats").getByRole("term")).toHaveText([
      "Quests completed",
      "Skills unlocked",
      "Class",
      /^Currently learning$/,
    ]);
    // No age signals or dates anywhere on the page (DESIGN.md "Content and privacy").
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\byears?\b|\bsince\b/i);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description ?? "").not.toMatch(/\byears?\b|\b(19|20)\d{2}\b/i);
  });

  for (const width of [375, 768, 1280]) {
    test(`home hero fits at ${width} px without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole("link", { name: "Press Start: view projects" })).toBeInViewport();
    });
  }

  test("home logo boots up and the CTA pulses when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.getByTestId("hero-logo")).toHaveCSS("animation-name", "boot");
    await expect(page.getByTestId("press-start")).toHaveCSS("animation-name", "cta-pulse");
  });

  test("home boot-up and pulse are off under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("hero-logo")).toHaveCSS("animation-name", "none");
    await expect(page.getByTestId("press-start")).toHaveCSS("animation-name", "none");
    await expect(page.getByTestId("hero-logo")).toHaveCSS("opacity", "1");
  });

  test("home hero is readable with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Press Start: view projects" })).toBeVisible();
    await expect(page.getByLabel("Player stats")).toBeVisible();
    await context.close();
  });

  test("projects list links to a detail page that shows its tech", async ({ page, request }) => {
    const [first]: { slug: string; title: string; tech: string[] }[] = await (
      await request.get("/api/projects")
    ).json();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
    await page.getByRole("link", { name: first.title, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(first.slug)}$`));
    await expect(page.getByRole("heading", { level: 1, name: first.title })).toBeVisible();
    const tech = page.getByRole("list", { name: `Technologies used in ${first.title}` });
    await expect(tech.getByRole("listitem")).toHaveText(first.tech);
  });

  test("unknown project slug shows the not-found page and is not indexed", async ({ page }) => {
    await page.goto("/projects/does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });

  // Browser-free status checks (`request` fixture only). Proxy rejects unknown slugs before
  // rendering, so the response is a real 404 that still carries the not-found page.
  test("unknown project slug responds with HTTP 404 and the not-found page", async ({
    request,
  }) => {
    for (const path of ["/projects/does-not-exist", "/projects/PROJECT-ONE"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      const html = await res.text();
      expect(html).toMatch(NOT_FOUND_HEADING);
      expect(html).toMatch(/<meta name="robots" content="noindex"/);
    }
  });

  test("unknown project slug with a trailing slash ends in a 404", async ({ request }) => {
    const res = await request.get("/projects/does-not-exist/");
    expect(res.status()).toBe(404);
    expect(await res.text()).toMatch(NOT_FOUND_HEADING);
  });

  test("every known project slug responds with HTTP 200", async ({ request }) => {
    const projects: { slug: string; title: string }[] = await (
      await request.get("/api/projects")
    ).json();
    expect(projects.length).toBeGreaterThan(0);
    for (const { slug, title } of projects) {
      const res = await request.get(`/projects/${slug}`);
      expect(res.status(), slug).toBe(200);
      const html = await res.text();
      expect(html).toMatch(h1WithText(title));
      expect(html).not.toMatch(NOT_FOUND_HEADING);
    }
  });

  for (const [path, label] of [
    ["/projects", "Projects"],
    ["/experience", "Experience"],
    ["/about", "About"],
  ] as const) {
    test(`nav marks ${label} as current on ${path}`, async ({ page }) => {
      await page.goto(path);
      const nav = mainNav(page);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    });
  }

  test("nav keeps Projects current on a project detail page", async ({ page }) => {
    await page.goto("/projects/project-one");
    await expect(mainNav(page).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("experience page renders the timeline", async ({ page, request }) => {
    const entries: { role: string; company: string }[] = await (
      await request.get("/api/experience")
    ).json();
    await page.goto("/experience");
    await expect(page.getByRole("heading", { level: 1, name: "Experience" })).toBeVisible();
    for (const entry of entries) {
      await expect(
        page.getByRole("heading", { level: 2, name: `${entry.role}, ${entry.company}` }),
      ).toBeVisible();
    }
  });

  test("about page renders skills and contact links", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Skills" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Get in touch" })).toBeVisible();
  });

  test("navigating via the header reaches each section", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Experience", "About", "Projects"]) {
      await mainNav(page).getByRole("link", { name: label }).click();
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    }
  });
});

test.describe("HUD frame", () => {
  test("header and footer frame the not-found page too", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(mainNav(page)).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByTestId("boost-meter")).toHaveCount(1);
  });

  test("skip link appears on focus and moves to the main content", async ({ page }) => {
    await page.goto("/about");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    const box = await skip.boundingBox();
    expect(box && box.width > 1 && box.height > 1).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("nav fits at 375 px and every destination is reachable by keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/");
    const nav = mainNav(page);
    for (const label of ["Projects", "Experience", "About"]) {
      const link = nav.getByRole("link", { name: label });
      await expect(link).toBeInViewport({ ratio: 1 });
      const box = await link.boundingBox();
      expect(box!.height, label).toBeGreaterThanOrEqual(44);
    }
    // Skip link, home link, then the three destinations in order.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link").first()).toBeFocused();
    for (const label of ["Projects", "Experience", "About"]) {
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("link", { name: label })).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
  });

  test("boost meter is decorative and fills from top to bottom of a long page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto("/about");
    const meter = page.getByTestId("boost-meter");
    await expect(meter).toHaveAttribute("aria-hidden", "true");
    await expect(meter).toHaveCSS("position", "fixed");
    await expect(meter).toHaveCSS("pointer-events", "none");

    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 100,
    );
    expect(scrollable).toBe(true);
    await expect(meter).toHaveAttribute("data-progress", "0.000");

    const mainTop = await page.locator("main").evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2),
    );
    await expect
      .poll(async () => Number(await meter.getAttribute("data-progress")))
      .toBeGreaterThan(0.3);
    await expect
      .poll(async () => Number(await meter.getAttribute("data-progress")))
      .toBeLessThan(0.7);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(meter).toHaveAttribute("data-progress", "1.000");

    // Fixed overlay: scrolling back to the top leaves the layout exactly where it was.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(meter).toHaveAttribute("data-progress", "0.000");
    expect(await page.locator("main").evaluate((el) => el.getBoundingClientRect().top)).toBe(
      mainTop,
    );
  });

  test("boost meter eases when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/about");
    await expect(page.getByTestId("boost-meter-fill")).toHaveCSS("transition-duration", /^0\.15s/);
  });

  test("boost meter and nav links do not animate under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const targets = [
      page.getByTestId("boost-meter-fill"),
      mainNav(page).getByRole("link", { name: "Projects" }),
      page.getByRole("contentinfo").getByRole("link").first(),
    ];
    for (const target of targets) {
      const { property, duration } = await target.evaluate((el) => {
        const style = getComputedStyle(el);
        return { property: style.transitionProperty, duration: style.transitionDuration };
      });
      expect(property === "none" || /^(0s|1e-05s|0\.00001s)/.test(duration)).toBe(true);
    }
  });
});
