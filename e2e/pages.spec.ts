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

  test("projects page is a quest board of cards with tech tags and no dates", async ({
    page,
    request,
  }) => {
    const projects: { slug: string; title: string; tech: string[] }[] = await (
      await request.get("/api/projects")
    ).json();
    await page.goto("/projects");
    await expect(page.getByText("Quest board")).toBeVisible();
    const cards = page.getByTestId("project-card");
    await expect(cards).toHaveCount(projects.length);
    for (const [index, project] of projects.entries()) {
      const card = cards.nth(index);
      // One link per card (the stretched title link), pointing at the detail page.
      await expect(card.getByRole("link")).toHaveCount(1);
      await expect(card.getByRole("link")).toHaveAttribute("href", `/projects/${project.slug}`);
      await expect(
        card.getByRole("list", { name: `Technologies used in ${project.title}` }),
      ).toBeVisible();
    }
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(text).not.toMatch(/\bpresent\b/i);
  });

  test("clicking anywhere on a card opens its detail page", async ({ page, request }) => {
    const [first]: { slug: string }[] = await (await request.get("/api/projects")).json();
    await page.goto("/projects");
    // Click the image area, far from the title text: the stretched link covers the card.
    // Clicking the <img> locator itself would fail Playwright's hit-target check, because the
    // stretched link (correctly) sits on top of it; click the card at the image's position.
    const card = page.getByTestId("project-card").first();
    // The quest board streams in behind a "Loading quests…" fallback: wait until it is shown.
    await expect(card.locator("img")).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    const imgBox = (await card.locator("img").boundingBox())!;
    await card.click({
      position: {
        x: imgBox.x - cardBox.x + imgBox.width / 2,
        y: imgBox.y - cardBox.y + imgBox.height / 2,
      },
    });
    await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(first.slug)}$`));
  });

  test("keyboard focus on a card shows the glow", async ({ page }) => {
    await page.goto("/projects");
    const card = page.getByTestId("project-card").first();
    const before = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    await card.getByRole("link").focus();
    await expect(card.getByRole("link")).toBeFocused();
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(before);
    await expect(card).not.toHaveCSS("box-shadow", "none");
  });

  test("cards tilt towards a fine pointer, at most about 6 degrees, and reset on leave", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/projects");
    const tilt = page.getByTestId("tilt-card").first();
    await expect(tilt).toHaveAttribute("data-tilt", "on");
    // The quest board streams in behind a "Loading quests…" fallback: wait until it is shown.
    await expect(tilt).toBeVisible();
    const box = (await tilt.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 24, box.y + 24, { steps: 5 });
    await expect.poll(() => tilt.evaluate((el) => el.style.transform)).toMatch(/rotateX/);
    const angles = await tilt.evaluate((el) =>
      [...el.style.transform.matchAll(/rotate[XY]\((-?[\d.]+)deg\)/g)].map((m) => Number(m[1])),
    );
    expect(angles).toHaveLength(2);
    for (const angle of angles) expect(Math.abs(angle)).toBeLessThanOrEqual(6);

    await page.mouse.move(0, 0);
    await expect.poll(() => tilt.evaluate((el) => el.style.transform)).toBe("");
  });

  test("cards do not tilt under reduced motion but still glow on hover", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/projects");
    const tilt = page.getByTestId("tilt-card").first();
    await expect(tilt).toHaveAttribute("data-tilt", "off");
    // The quest board streams in behind a "Loading quests…" fallback: wait until it is shown.
    await expect(tilt).toBeVisible();
    const box = (await tilt.boundingBox())!;
    await page.mouse.move(box.x + box.width - 24, box.y + 24, { steps: 5 });
    await expect(tilt).toHaveCSS("transform", "none");
    await expect(page.getByTestId("project-card").first()).not.toHaveCSS("box-shadow", "none");
  });

  test("project detail page shows the quest in the new style without dates", async ({
    page,
    request,
  }) => {
    const [first]: {
      slug: string;
      title: string;
      tech: string[];
      links: { repo?: string; live?: string };
    }[] = await (await request.get("/api/projects")).json();
    await page.goto(`/projects/${first.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: first.title })).toBeVisible();
    await expect(page.getByTestId("project-hero-image")).toBeVisible();
    await expect(page.getByTestId("project-hero-image")).toHaveAttribute("fetchpriority", "high");
    await expect(
      page.getByRole("list", { name: `Technologies used in ${first.title}` }).getByRole("listitem"),
    ).toHaveText(first.tech);
    if (first.links.repo) {
      const repo = page.getByRole("link", { name: /^View source code/ });
      await expect(repo).toHaveAttribute("href", first.links.repo);
      await expect(repo).toHaveAttribute("rel", "noopener noreferrer");
    }
    await page.getByRole("link", { name: "All projects" }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test("no project page or its metadata exposes a date", async ({ request }) => {
    const projects: { slug: string }[] = await (await request.get("/api/projects")).json();
    for (const path of ["/", "/projects", ...projects.map((p) => `/projects/${p.slug}`)]) {
      const html = await (await request.get(path)).text();
      // Raw YYYY-MM values (HTML, RSC payload, metadata) and formatted ranges.
      expect(html, path).not.toMatch(/\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/);
      expect(html, path).not.toMatch(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (19|20)\d{2}\b/,
      );
      expect(html, path).not.toMatch(/startDate|endDate/);
    }
  });

  for (const width of [375, 768, 1280]) {
    test(`projects and a detail page fit at ${width} px without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/projects", "/projects/project-one"]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  }

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

  test("experience chapters: latest open, others expand with mouse and keyboard", async ({
    page,
  }) => {
    await page.goto("/experience");
    const chapters = page.getByTestId("quest-chapter");
    const count = await chapters.count();
    expect(count).toBeGreaterThan(1);
    await expect(chapters.first()).toHaveAttribute("open", "");
    for (let i = 1; i < count; i++) await expect(chapters.nth(i)).not.toHaveAttribute("open");
    await expect(chapters.first().getByText("Chapter 01")).toBeVisible();

    const second = chapters.nth(1);
    const summary = second.locator("summary");
    const body = second.getByTestId("chapter-body");
    await expect(body).toBeHidden();
    await summary.click();
    await expect(second).toHaveAttribute("open", "");
    await expect(body).toBeVisible();
    await summary.click();
    await expect(second).not.toHaveAttribute("open");

    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(second).not.toHaveAttribute("open");
  });

  test("experience page shows no dates (DATED_COMPANY_LIMIT is 0)", async ({ page, request }) => {
    const html = await (await request.get("/experience")).text();
    expect(html).not.toMatch(/startDate|endDate/);
    expect(html).not.toMatch(/\b(19|20)\d{2}-\d{2}\b/);
    await page.goto("/experience");
    const text = await page.getByRole("main").innerText();
    expect(text).not.toMatch(/\b(19|20)\d{2}\b|\bpresent\b/i);
  });

  test("experience chapter expands and collapses with a touch tap", async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/experience");
    const second = page.getByTestId("quest-chapter").nth(1);
    await second.locator("summary").tap();
    await expect(second).toHaveAttribute("open", "");
    await expect(second.getByTestId("chapter-body")).toBeVisible();
    await second.locator("summary").tap();
    await expect(second).not.toHaveAttribute("open");
    await context.close();
  });

  test("experience reveal and marker animations are off under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/experience");
    const second = page.getByTestId("quest-chapter").nth(1);
    await second.locator("summary").click();
    const body = second.getByTestId("chapter-body");
    await expect(body).toHaveCSS("animation-name", "none");
    await expect(second.getByTestId("chapter-marker")).toHaveCSS("transition-property", "none");
  });

  test("about page renders skills and contact links", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Skills" })).toBeVisible();
    const contact = page.getByRole("region", { name: "Join the party" });
    await expect(contact.getByRole("heading", { level: 2, name: "Join the party" })).toBeVisible();
    const profile: { email?: string; socials: { label: string; url: string }[] } = await (
      await page.request.get("/api/profile")
    ).json();
    if (profile.email) {
      await expect(contact.getByRole("link", { name: "Email me" })).toHaveAttribute(
        "href",
        `mailto:${profile.email}`,
      );
    }
    for (const social of profile.socials) {
      const link = contact.getByRole("link", { name: new RegExp(`^${social.label}\\b`) });
      await expect(link).toHaveAttribute("href", social.url);
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("home ends with the Join the party band", async ({ page }) => {
    await page.goto("/");
    const band = page.getByRole("region", { name: "Join the party" });
    await band.scrollIntoViewIfNeeded();
    await expect(band.getByRole("heading", { level: 2, name: "Join the party" })).toBeVisible();
    await expect(band.getByRole("link", { name: "Email me" })).toHaveAttribute("href", /^mailto:/);
  });

  for (const path of ["/", "/projects", "/experience", "/about"]) {
    test(`nav Contact on ${path} scrolls to the contact section below the header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 700 });
      await page.goto(path);
      await mainNav(page).getByRole("link", { name: "Contact" }).click();
      await expect(page).toHaveURL(/\/about#contact$/);
      // Role queries skip the hidden previous page that Next keeps mounted (for example Home's
      // own "Join the party" band, id="contact-band"), so this is the visible About section.
      const section = page.getByRole("region", { name: "Join the party" });
      await expect(section).toBeInViewport();
      const headerBottom = await page
        .getByRole("banner")
        .evaluate((el) => el.getBoundingClientRect().bottom);
      await expect
        .poll(() =>
          section
            .getByRole("heading", { name: "Join the party" })
            .evaluate((el) => el.getBoundingClientRect().top),
        )
        .toBeGreaterThanOrEqual(headerBottom);
      // About stays the one current item; Contact is never marked current.
      await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(1);
      await expect(mainNav(page).getByRole("link", { name: "About" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  test("copy email confirms through the live region", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/about");
    const contact = page.getByRole("region", { name: "Join the party" });
    await contact.getByRole("button", { name: "Copy email" }).click();
    await expect(contact.getByRole("status")).toHaveText("Copied");
  });

  test("email CTA pulses on hover only when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/about");
    const cta = page.getByRole("region", { name: "Join the party" }).getByRole("link", {
      name: "Email me",
    });
    await cta.hover();
    await expect(cta).toHaveCSS("animation-name", "party-pulse");
  });

  test("email CTA does not animate under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const cta = page.getByRole("region", { name: "Join the party" }).getByRole("link", {
      name: "Email me",
    });
    await cta.hover();
    await expect(cta).toHaveCSS("animation-name", "none");
    await cta.focus();
    await expect(cta).toHaveCSS("animation-name", "none");
  });

  for (const width of [375, 768, 1280]) {
    test(`about character sheet fits at ${width} px without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/about");
      await expect(page.getByTestId("identity-panel")).toBeVisible();
      await expect(page.getByLabel("Character stats")).toBeVisible();
      await expect(page.getByTestId("skill-tree")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  for (const width of [768, 1280]) {
    test(`about skill names never break mid-word at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/about");
      await expect(page.getByTestId("skill-name").first()).toBeVisible();
      // For every word of every skill name, a Range over that word must cover a single line box.
      const broken = await page.getByTestId("skill-name").evaluateAll((names) =>
        names.flatMap((name) => {
          const text = name.firstChild;
          if (!(text instanceof Text)) return [`${name.textContent}: no text node`];
          const value = text.data;
          const failures: string[] = [];
          for (const match of value.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(text, match.index);
            range.setEnd(text, match.index + match[0].length);
            if (range.getClientRects().length !== 1) failures.push(`${value}: "${match[0]}"`);
          }
          return failures;
        }),
      );
      expect(broken).toEqual([]);
    });
  }

  test("about skill map gives ranks as text and has no progress bars", async ({ page }) => {
    await page.goto("/about");
    const skills = page.getByRole("region", { name: "Skills" });
    await expect(skills.getByTestId("skill-node").first()).toHaveAccessibleName(
      /, (Mastered|Proficient|Learning)/,
    );
    // The ring is decoration; the rank is text in the details panel too.
    await skills.getByTestId("skill-node").first().click();
    await expect(skills.getByTestId("skill-details")).toContainText(
      /(Mastered|Proficient|Learning)/,
    );
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.locator("progress, meter")).toHaveCount(0);
  });

  test("a skill's quest link opens the filtered quest board", async ({ page, request }) => {
    const projects: { title: string; tech: string[] }[] = await (
      await request.get("/api/projects")
    ).json();
    const profile: { skillTree: { skills: { name: string }[] }[] } = await (
      await request.get("/api/profile")
    ).json();
    const usedBy = (name: string) =>
      projects
        .filter((p) => p.tech.some((t) => t.trim().toLowerCase() === name.toLowerCase()))
        .map((p) => p.title);
    // The first skill (in the first branch, so it is visible at any width) used by a quest.
    const name = profile.skillTree[0].skills.map((s) => s.name).find((n) => usedBy(n).length > 0);
    expect(name).toBeDefined();
    const expected = usedBy(name!);
    await page.goto("/about");
    const skills = page.getByRole("region", { name: "Skills" });
    await skills.getByRole("button", { name: new RegExp(`^${escapeRegExp(name!)},`) }).click();
    const link = skills.getByTestId("skill-details").getByRole("link", {
      name: new RegExp(`^Used in \\d+ quests? \\(${escapeRegExp(name!)}\\)$`),
    });
    await link.click();
    await expect(page).toHaveURL(`/projects?tech=${encodeURIComponent(name!)}`);
    const filter = page.getByRole("region", { name: `Quests using ${name}` });
    await expect(filter.getByRole("heading", { level: 3 })).toHaveText(expected);
    await filter.getByRole("link", { name: "Show all quests" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId("project-card")).toHaveCount(projects.length);
  });

  test("an unknown ?tech value shows the empty state", async ({ page }) => {
    const response = await page.goto("/projects?tech=does-not-exist");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 2, name: "No matching quests" })).toBeVisible();
    await expect(page.getByText("No quests use that technology yet.")).toBeVisible();
    await expect(page.getByTestId("project-card")).toHaveCount(0);
  });

  test("skill rank rings unlock when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/about");
    await expect(page.locator('[data-testid="rank-segment"][data-lit="true"]').first()).toHaveCSS(
      "animation-name",
      "pip-unlock",
    );
  });

  test("skill rank ring unlock is off under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const lit = page.locator('[data-testid="rank-segment"][data-lit="true"]');
    await expect(lit.first()).toHaveCSS("animation-name", "none");
    await expect(lit.first()).toHaveCSS("opacity", "1");
  });

  test("skill nodes and quest links are keyboard reachable with a visible focus ring", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/about");
    const skills = page.getByRole("region", { name: "Skills" });
    const start = skills.getByRole("button", { name: /^Start,/ });
    // Tab through the page until the map's single Tab stop (the start node) has focus.
    for (let i = 0; i < 60 && !(await start.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(start).toBeFocused();
    await expect(start.getByTestId("node-focus-ring")).toHaveCSS("opacity", "1");
    // Arrow to a skill with quests, then Tab moves on to its link in the details panel.
    const link = skills.getByTestId("skill-details").getByRole("link");
    for (let i = 0; i < 30 && (await link.count()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
    }
    // Past any "Unlocks" chips to the quest link.
    for (let i = 0; i < 6 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-style", "solid");
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
    const tops = new Set<number>();
    for (const label of ["Projects", "Experience", "About", "Contact"]) {
      const link = nav.getByRole("link", { name: label });
      await expect(link).toBeInViewport({ ratio: 1 });
      const box = await link.boundingBox();
      expect(box!.height, label).toBeGreaterThanOrEqual(44);
      // The label fits its target: nothing clipped.
      expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth), label).toBe(true);
      tops.add(Math.round(box!.y));
    }
    // All four destinations share one row.
    expect(tops.size).toBe(1);
    // Skip link, home link, then the four destinations in order.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link").first()).toBeFocused();
    for (const label of ["Projects", "Experience", "About", "Contact"]) {
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("link", { name: label })).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/about#contact$/);
    await expect(page.getByRole("heading", { level: 2, name: "Join the party" })).toBeInViewport();
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
