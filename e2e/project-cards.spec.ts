import { devices, expect, test } from "@playwright/test";

/** Tester-added coverage for issue #7: home featured cards and touch devices never tilting. */
test.describe("project cards (issue #7)", () => {
  test("home featured section uses the quest cards, each linking to its detail page with tech tags", async ({
    page,
    request,
  }) => {
    const featured: { slug: string; title: string; tech: string[] }[] = await (
      await request.get("/api/projects?featured=true")
    ).json();
    expect(featured.length).toBeGreaterThan(0);

    await page.goto("/");
    const section = page.getByRole("region", { name: "Featured projects" });
    await expect(section.getByTestId("project-card")).toHaveCount(featured.length);
    await expect(section.getByTestId("tilt-card")).toHaveCount(featured.length);
    for (const project of featured) {
      await expect(section.getByRole("link", { name: project.title })).toHaveAttribute(
        "href",
        `/projects/${project.slug}`,
      );
      await expect(
        section
          .getByRole("list", { name: `Technologies used in ${project.title}` })
          .getByRole("listitem"),
      ).toHaveText(project.tech);
    }
  });

  test("home HTML contains no project dates", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).not.toMatch(/startDate|endDate/);
    expect(html).not.toMatch(/\b(19|20)\d{2}-\d{2}\b/);
  });

  test("server-rendered HTML marks tilt cards off until the client checks the pointer", async ({
    request,
  }) => {
    const html = await (await request.get("/projects")).text();
    expect(html).toMatch(/data-tilt="off"/);
    expect(html).not.toMatch(/data-tilt="on"/);
  });

  test("cards never tilt on a touch (coarse pointer) device", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
    const page = await context.newPage();
    try {
      await page.goto("/projects");
      const tilt = page.getByTestId("tilt-card").first();
      await expect(tilt).toBeVisible();
      // The attribute reflects the fine-pointer gate, so a touch device reports it off.
      await expect(tilt).toHaveAttribute("data-tilt", "off");
      const box = (await tilt.boundingBox())!;
      // A coarse-pointer device: even pointer moves must not tilt (the media query gate).
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width - 20, box.y + 20, { steps: 5 });
      // Give a queued animation frame time to apply, if one were (wrongly) scheduled.
      await page.waitForTimeout(200);
      expect(await tilt.evaluate((el) => el.style.transform)).toBe("");
    } finally {
      await context.close();
    }
  });
});
