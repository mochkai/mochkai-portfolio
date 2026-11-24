import { expect, test, type Page } from "@playwright/test";

/** The `Main` navigation landmark in the site header. */
function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

/** The not-found page's `<h1>` in server-rendered HTML. */
const NOT_FOUND_HEADING = /<h1[^>]*>Page not found<\/h1>/;

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
      expect(html).toMatch(new RegExp(`<h1[^>]*>${title}</h1>`));
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
