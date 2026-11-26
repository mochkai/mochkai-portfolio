import { expect, test, type Page } from "@playwright/test";

/** The `Main` navigation landmark in the site header. */
function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

/** The "Join the party" contact section or band. */
function contact(page: Page) {
  return page.getByRole("region", { name: "Join the party" });
}

test.describe("Join the party contact", () => {
  for (const width of [375, 1280]) {
    test(`loading /about#contact at ${width} px lands the heading below the header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/about#contact");
      const heading = contact(page).getByRole("heading", { level: 2, name: "Join the party" });
      await expect(heading).toBeInViewport();
      const headerBottom = await page
        .getByRole("banner")
        .evaluate((el) => Math.max(0, el.getBoundingClientRect().bottom));
      await expect
        .poll(() => heading.evaluate((el) => el.getBoundingClientRect().top))
        .toBeGreaterThanOrEqual(headerBottom);
    });
  }

  test("Contact nav item works from a nested project page", async ({ page }) => {
    await page.goto("/projects/project-one");
    await mainNav(page).getByRole("link", { name: "Contact" }).click();
    await expect(page).toHaveURL(/\/about#contact$/);
    await expect(contact(page).getByRole("heading", { name: "Join the party" })).toBeInViewport();
  });

  test("Copy email writes the address to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const profile: { email?: string } = await (await page.request.get("/api/profile")).json();
    test.skip(!profile.email, "no email in the content data");
    await page.goto("/about");
    await contact(page).getByRole("button", { name: "Copy email" }).click();
    await expect(contact(page).getByRole("status")).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(profile.email);
  });

  test("home band shows every social link as an external link", async ({ page }) => {
    const profile: { socials: { label: string; url: string }[] } = await (
      await page.request.get("/api/profile")
    ).json();
    await page.goto("/");
    const band = contact(page);
    for (const social of profile.socials) {
      const link = band.getByRole("link", { name: new RegExp(`^${social.label}\\b`) });
      await expect(link).toHaveAttribute("href", social.url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  for (const width of [375, 768, 1280]) {
    test(`home with the band fits at ${width} px without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await contact(page).scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("email CTA keeps a static box-shadow under reduced motion while hovered", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const cta = contact(page).getByRole("link", { name: "Email me" });
    await cta.hover();
    await page.waitForTimeout(300);
    const a = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
    await page.waitForTimeout(700);
    const b = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(b).toBe(a);
    await expect(cta).toHaveCSS("animation-name", "none");
  });

  test("email CTA pulses on keyboard focus when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/about");
    const cta = contact(page).getByRole("link", { name: "Email me" });
    // Tab until the CTA has keyboard focus, so :focus-visible applies.
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      if (await cta.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS("animation-name", "party-pulse");
  });
});
