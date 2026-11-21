import { expect, test, type Page } from "@playwright/test";

/** The `Main` navigation landmark in the site header. */
function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
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

  test("projects list links to a detail page that shows its tech", async ({ page, request }) => {
    const [first]: { slug: string; title: string; tech: string[] }[] = await (
      await request.get("/api/projects")
    ).json();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
    await page.getByRole("link", { name: first.title, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${first.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: first.title })).toBeVisible();
    const tech = page.getByRole("list", { name: `Technologies used in ${first.title}` });
    await expect(tech.getByRole("listitem")).toHaveText(first.tech);
  });

  test("unknown project slug shows the not-found page and is not indexed", async ({ page }) => {
    await page.goto("/projects/does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });

  // Known limitation: with Cache Components the prerendered shell is streamed with a 200
  // before the page calls notFound(), so the status stays 200 (Next adds noindex instead).
  // Un-fixme once a slug check in Proxy returns a real 404 before rendering starts.
  test.fixme("unknown project slug responds with HTTP 404", async ({ page }) => {
    const response = await page.goto("/projects/does-not-exist");
    expect(response?.status()).toBe(404);
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
