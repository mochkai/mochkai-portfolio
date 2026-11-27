import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AboutPage from "@/app/about/page";
import ExperiencePage from "@/app/experience/page";
import HomePage from "@/app/page";
import ProjectPage, { generateMetadata, generateStaticParams } from "@/app/projects/[slug]/page";
import ProjectsPage from "@/app/projects/page";
import experienceData from "@/data/experience.json";
import profileData from "@/data/profile.json";
import projectsData from "@/data/projects.json";
import { formatDateRange, formatMonth } from "@/lib/format";
import { RANK_PIPS, rankLabel } from "@/lib/skills";

/**
 * Every way a project date from the content data could show up in markup: the raw `YYYY-MM`
 * values and the formatted months and ranges.
 */
const PROJECT_DATE_STRINGS = projectsData.flatMap((p) => {
  const months = [p.startDate, p.endDate].filter((d): d is string => d !== null);
  return [...months, ...months.map(formatMonth), formatDateRange(p.startDate, p.endDate)];
});

/**
 * Asserts that `container` shows no project dates. Raw and formatted dates are checked on the
 * HTML (attributes included); bare years and "Present" only on the visible text, because image
 * URLs can legitimately contain numbers such as `w=1920`. A string (serialized metadata) gets
 * every check.
 */
function expectNoProjectDates(target: HTMLElement | string) {
  const html = typeof target === "string" ? target : target.innerHTML;
  const text = typeof target === "string" ? target : (target.textContent ?? "");
  for (const value of PROJECT_DATE_STRINGS) expect(html).not.toContain(value);
  expect(html).not.toMatch(/\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/);
  expect(html).not.toMatch(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w* \d/i);
  for (const p of projectsData) expect(text).not.toContain(p.startDate.slice(0, 4));
  expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
  expect(text).not.toMatch(/\bpresent\b/i);
}

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

/** Props for the projects page, with the given search params. */
function projectsProps(search: Record<string, string | string[]> = {}) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<
    typeof ProjectsPage
  >[0];
}

/**
 * Renders the projects page and waits for its Suspense-wrapped list (a promise child) to
 * resolve; the awaited `act` lets React retry the suspended boundary.
 */
async function renderProjects(search: Record<string, string | string[]> = {}) {
  const result = await act(async () => render(ProjectsPage(projectsProps(search))));
  expect(screen.queryByText("Loading quests…")).not.toBeInTheDocument();
  return result;
}

/** Projects whose `tech` contains `name`, compared case-insensitively after trimming. */
function projectsUsing(name: string) {
  const key = name.trim().toLowerCase();
  return projectsData.filter((p) => p.tech.some((t) => t.trim().toLowerCase() === key));
}

/** Escapes RegExp metacharacters so `text` matches literally inside a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `params` prop for the project detail page. */
function slugProps(slug: string) {
  return { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) } as Parameters<
    typeof ProjectPage
  >[0];
}

describe("HomePage", () => {
  it("shows the profile and only featured projects", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: profileData.name })).toBeInTheDocument();
    const featured = screen.getByRole("region", { name: "Featured projects" });
    const titles = within(featured)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles.sort()).toEqual(
      projectsData
        .filter((p) => p.featured)
        .map((p) => p.title)
        .sort(),
    );
  });

  it("ends with the Join the party contact band", async () => {
    render(await HomePage());
    const band = screen.getByRole("region", { name: "Join the party" });
    expect(band).toHaveAttribute("id", "contact-band");
    expect(document.getElementById("contact")).toBeNull();
    expect(within(band).getByRole("link", { name: "Email me" })).toHaveAttribute(
      "href",
      `mailto:${profileData.email}`,
    );
    for (const social of profileData.socials) {
      expect(
        within(band).getByRole("link", {
          name: new RegExp(`^${social.label}\\b.*opens in a new tab`),
        }),
      ).toHaveAttribute("href", social.url);
    }
    // After the featured projects.
    const featured = screen.getByRole("region", { name: "Featured projects" });
    expect(featured.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is a title screen: logo, Player 1 label, one h1, bio and CTAs", async () => {
    render(await HomePage());
    const hero = screen.getByRole("region", { name: profileData.name });
    expect(within(hero).getByTestId("hero-logo")).toHaveAttribute("alt", "");
    expect(within(hero).getByTestId("hero-logo")).toHaveAttribute("fetchpriority", "high");
    expect(within(hero).getByText(`Player 1 · ${profileData.title}`)).toHaveClass("font-mono");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(hero).getByText(profileData.bio)).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: "Press Start: view projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(within(hero).getByRole("link", { name: "Read experience" })).toHaveAttribute(
      "href",
      "/experience",
    );
    expect(within(hero).getByRole("link", { name: "About me" })).toHaveAttribute("href", "/about");
  });

  it("shows a scoreboard computed from the content data", async () => {
    render(await HomePage());
    const grid = screen.getByLabelText("Player stats");
    const terms = within(grid)
      .getAllByRole("term")
      .map((t) => t.textContent);
    const values = within(grid)
      .getAllByRole("definition")
      .map((d) => d.textContent);
    const technologies = new Set(
      projectsData.flatMap((p) => p.tech.map((t) => t.trim().toLowerCase())),
    );
    expect(terms).toEqual(["Quests completed", "Skills unlocked", "Class", "Currently learning"]);
    expect(values).toEqual([
      String(projectsData.length),
      String(technologies.size),
      profileData.characterClass,
      profileData.currentlyLearning.join(" · "),
    ]);
  });

  // DESIGN.md: no age signals and no dates anywhere, including the featured projects.
  it("shows no age signals and no dates anywhere on the page", async () => {
    const { container } = render(await HomePage());
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\byears?\b|\bsince\b|\bpresent\b/i);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(text).not.toMatch(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w* \d/i);
    expectNoProjectDates(container);
  });

  it("shows the featured projects as quest cards", async () => {
    render(await HomePage());
    const featured = screen.getByRole("region", { name: "Featured projects" });
    expect(within(featured).getAllByTestId("project-card")).toHaveLength(
      projectsData.filter((p) => p.featured).length,
    );
  });

  it("runs the boot-up and pulse animations only under motion-safe", async () => {
    render(await HomePage());
    const logo = screen.getByTestId("hero-logo");
    const cta = screen.getByTestId("press-start");
    expect(logo).toHaveClass("motion-safe:animate-boot");
    expect(cta).toHaveClass("motion-safe:animate-cta-pulse", "motion-safe:hover:animate-none");
    // No unconditional animation that a motion-reduce: variant would have to override.
    for (const element of [logo, cta]) {
      expect(element.className).not.toMatch(/(^|\s)(hover:)?animate-/);
    }
  });

  it("puts a decorative parallax rune circuit behind the hero", async () => {
    render(await HomePage());
    const layer = screen.getByTestId("parallax-layer");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none", "absolute");
    expect(layer.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ProjectsPage", () => {
  it("is a quest board of project cards, each linking to its detail page", async () => {
    await renderProjects();
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("Quest board")).toHaveClass("font-mono");
    expect(screen.getAllByTestId("project-card")).toHaveLength(projectsData.length);
    for (const project of projectsData) {
      expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
        "href",
        `/projects/${project.slug}`,
      );
      expect(
        screen.getByRole("list", { name: `Technologies used in ${project.title}` }),
      ).toBeInTheDocument();
    }
  });

  it("renders no project dates", async () => {
    const { container } = await renderProjects();
    expectNoProjectDates(container);
  });

  it("without ?tech shows every project and no filter bar", async () => {
    await renderProjects();
    expect(screen.queryByTestId("quest-filter")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show all quests" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("project-card")).toHaveLength(projectsData.length);
  });

  it("?tech=<name> lists exactly the matching projects, case-insensitively", async () => {
    const tech = projectsData[0].tech[0];
    const expected = projectsUsing(tech);
    await renderProjects({ tech: `  ${tech.toUpperCase()} ` });
    const filter = screen.getByRole("region", { name: `Quests using ${tech}` });
    const titles = within(filter)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(expected.map((p) => p.title));
    expect(within(filter).getByRole("link", { name: "Show all quests" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it.each([["Cobol <b>now</b>"], [""]])(
    "shows the empty state for ?tech=%j without echoing it",
    async (tech) => {
      const { container } = await renderProjects({ tech });
      expect(screen.getByRole("heading", { level: 2, name: "No matching quests" })).toBeVisible();
      expect(screen.getByText("No quests use that technology yet.")).toBeInTheDocument();
      expect(screen.queryAllByTestId("project-card")).toHaveLength(0);
      expect(screen.getByRole("link", { name: "Show all quests" })).toHaveAttribute(
        "href",
        "/projects",
      );
      if (tech) expect(container.textContent).not.toContain("Cobol");
    },
  );

  it("uses the first value of a repeated ?tech param", async () => {
    const tech = projectsData[0].tech[0];
    await renderProjects({ tech: [tech, "Unknown"] });
    expect(screen.getByRole("heading", { level: 2, name: `Quests using ${tech}` })).toBeVisible();
  });

  it("renders no project dates when filtered", async () => {
    const { container } = await renderProjects({ tech: projectsData[0].tech[0] });
    expectNoProjectDates(container);
  });
});

describe("ProjectPage", () => {
  const project = projectsData[0];

  it("shows the status, title, summary, description, technologies and external links", async () => {
    render(await ProjectPage(slugProps(project.slug)));
    expect(screen.getByRole("heading", { level: 1, name: project.title })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: project.title })).toBeInTheDocument();
    expect(
      screen.getByText(project.endDate === null ? "Active quest" : "Quest complete"),
    ).toBeInTheDocument();
    expect(screen.getByText(project.summary)).toBeInTheDocument();
    expect(screen.getByText(project.description)).toBeInTheDocument();
    const tech = screen.getByRole("list", { name: `Technologies used in ${project.title}` });
    expect(
      within(tech)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(project.tech);
    for (const [name, href] of [
      [/^View source code\b.*opens in a new tab/, project.links.repo],
      [/^Visit live site\b.*opens in a new tab/, project.links.live],
    ] as const) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "All projects" })).toHaveAttribute("href", "/projects");
  });

  it("loads the decorative hero image eagerly with high priority", async () => {
    render(await ProjectPage(slugProps(project.slug)));
    const image = screen.getByTestId("project-hero-image");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it.each(projectsData.map((p) => [p.slug]))("renders no project dates for %s", async (slug) => {
    const { container } = render(await ProjectPage(slugProps(slug)));
    expectNoProjectDates(container);
  });

  it("calls notFound() for an unknown slug", async () => {
    await expect(ProjectPage(slugProps("nope"))).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("prerenders one page per project", async () => {
    expect(await generateStaticParams()).toHaveLength(projectsData.length);
  });

  it("builds metadata from the project and returns {} for an unknown slug", async () => {
    expect(await generateMetadata(slugProps(project.slug))).toMatchObject({
      title: project.title,
      description: project.summary,
    });
    expect(await generateMetadata(slugProps("nope"))).toEqual({});
  });

  it.each(projectsData.map((p) => [p.slug]))(
    "puts no dates in the metadata for %s",
    async (slug) => {
      expectNoProjectDates(JSON.stringify(await generateMetadata(slugProps(slug))));
    },
  );
});

describe("ExperiencePage", () => {
  it("renders one entry per role", async () => {
    render(await ExperiencePage());
    expect(screen.getByRole("heading", { level: 1, name: "Experience" })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    for (const entry of experienceData) {
      expect(headings).toContain(`${entry.role}, ${entry.company}`);
    }
  });

  // DATED_COMPANY_LIMIT is 0: no experience dates on the page (DESIGN.md "Content and privacy").
  it("renders no experience dates with the real content data", async () => {
    const { container } = render(await ExperiencePage());
    const html = container.innerHTML;
    for (const entry of experienceData) {
      const months = [entry.startDate, entry.endDate].filter((d): d is string => d !== null);
      for (const value of [...months, ...months.map(formatMonth)]) {
        expect(html).not.toContain(value);
      }
    }
    expect(container.textContent).not.toMatch(/\b(19|20)\d{2}\b|\bpresent\b/i);
  });
});

describe("AboutPage", () => {
  it("renders skills and contact links", async () => {
    render(await AboutPage());
    expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeInTheDocument();
    for (const branch of profileData.skillTree) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${escapeRegExp(branch.name)} branch,`) }),
      ).toBeInTheDocument();
    }
    const contact = screen.getByRole("region", { name: "Join the party" });
    expect(contact).toHaveAttribute("id", "contact");
    expect(within(contact).getByRole("link", { name: "Email me" })).toHaveAttribute(
      "href",
      `mailto:${profileData.email}`,
    );
    for (const social of profileData.socials) {
      expect(
        within(contact).getByRole("link", {
          name: new RegExp(`^${social.label}\\b.*opens in a new tab`),
        }),
      ).toHaveAttribute("href", social.url);
    }
  });

  it("is a character sheet: one h1, then identity, contact, backstory and skills", async () => {
    render(await AboutPage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Character sheet")).toHaveClass("font-mono");
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent)
        .sort(),
    ).toEqual(["Backstory", "Join the party", "Skills", profileData.name].sort());
    const identity = screen.getByRole("region", { name: profileData.name });
    expect(within(identity).getByRole("img")).toHaveAttribute(
      "alt",
      `Portrait of ${profileData.name}`,
    );
    expect(within(identity).getByText(`Class · ${profileData.characterClass}`)).toHaveClass(
      "font-mono",
    );
    expect(within(identity).getByText(`Region · ${profileData.location}`)).toBeInTheDocument();
    const backstory = screen.getByRole("region", { name: "Backstory" });
    expect(within(backstory).getByText(profileData.bio)).toBeInTheDocument();
  });

  it("shows the character stats computed from the content data", async () => {
    render(await AboutPage());
    const grid = screen.getByLabelText("Character stats");
    const terms = within(grid)
      .getAllByRole("term")
      .map((t) => t.textContent);
    const values = within(grid)
      .getAllByRole("definition")
      .map((d) => d.textContent);
    const technologies = new Set(
      projectsData.flatMap((p) => p.tech.map((t) => t.trim().toLowerCase())),
    );
    const companies = new Set(experienceData.map((e) => e.company.trim().toLowerCase()));
    expect(terms).toEqual([
      "Quests completed",
      "Skills unlocked",
      "Guilds joined",
      "Class",
      "Currently learning",
    ]);
    expect(values).toEqual([
      String(projectsData.length),
      String(technologies.size),
      String(companies.size),
      profileData.characterClass,
      profileData.currentlyLearning.join(" · "),
    ]);
  });

  it("shows every skill map branch and node with its rank ring and accessible name", async () => {
    render(await AboutPage());
    const skills = screen.getByRole("region", { name: "Skills" });
    expect(within(skills).getByRole("button", { name: /^Start, / })).toBeInTheDocument();
    const branches = within(skills).getAllByTestId("skill-branch");
    expect(branches).toHaveLength(profileData.skillTree.length);
    profileData.skillTree.forEach((branch, branchIndex) => {
      const group = branches[branchIndex];
      expect(group).toHaveAccessibleName(`${branch.name} branch`);
      expect(
        within(group).getByRole("button", {
          name: `${branch.name} branch, ${branch.skills.length} skills`,
        }),
      ).toBeInTheDocument();
      const nodes = within(group).getAllByTestId("skill-node");
      expect(nodes).toHaveLength(branch.skills.length);
      const names = new Map(branch.skills.map((skill) => [skill.id, skill.name]));
      branch.skills.forEach((skill, index) => {
        const item = nodes[index];
        const rank = skill.rank as keyof typeof RANK_PIPS;
        const requires = ("requires" in skill ? (skill.requires ?? []) : []).map((id) =>
          names.get(id)!,
        );
        expect(item).toHaveAttribute("role", "button");
        expect(item).toHaveAccessibleName(
          new RegExp(
            `^${escapeRegExp(`${skill.name}, ${rankLabel(rank)}`)}${requires.length > 0 ? ", requires " : "$"}`,
          ),
        );
        const ring = within(item).getByTestId("rank-ring");
        expect(ring).toHaveAttribute("aria-hidden", "true");
        expect(ring.querySelectorAll('[data-lit="true"]')).toHaveLength(RANK_PIPS[rank]);
        expect(ring.querySelectorAll("[data-lit]")).toHaveLength(3);
      });
    });
    // Every skill name is drawn on the map.
    expect(
      within(skills)
        .getAllByTestId("skill-name")
        .map((name) => name.textContent),
    ).toEqual(profileData.skillTree.flatMap((branch) => branch.skills.map((skill) => skill.name)));
    // One spoke per hub, one link per skill on a hub and one per requires.
    const skillList = profileData.skillTree.flatMap((branch) => branch.skills);
    const expectedEdges =
      profileData.skillTree.length +
      skillList.reduce(
        (total, skill) =>
          total + Math.max(1, "requires" in skill ? (skill.requires?.length ?? 0) : 0),
        0,
      );
    expect(within(skills).getAllByTestId("skill-edge")).toHaveLength(expectedEdges);
  });

  it("marks the currently learning skill as Learning in the tree", async () => {
    render(await AboutPage());
    for (const name of profileData.currentlyLearning) {
      expect(screen.getByRole("button", { name: new RegExp(`^${name}, Learning`) })).toBeVisible();
    }
  });

  it("shows a skill's quest usage in the details panel, linked when used", async () => {
    render(await AboutPage());
    const skills = profileData.skillTree.flatMap((branch) => branch.skills);
    for (const skill of skills) {
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(`^${escapeRegExp(skill.name)},`) }),
      );
      const details = screen.getByTestId("skill-details");
      const count = projectsUsing(skill.name).length;
      if (count > 0) {
        const label = `Used in ${count} ${count === 1 ? "quest" : "quests"}`;
        expect(
          within(details).getByRole("link", { name: `${label} (${skill.name})` }),
        ).toHaveAttribute("href", `/projects?tech=${encodeURIComponent(skill.name)}`);
      } else {
        expect(within(details).queryByRole("link")).not.toBeInTheDocument();
        // The visible quest line; the sr-only live status repeats it for screen readers.
        expect(within(details).getByText("No quests yet", { selector: "span" })).toBeVisible();
      }
      expect(screen.getByTestId("skill-details-status")).toHaveTextContent(
        count > 0 ? `Used in ${count} ${count === 1 ? "quest" : "quests"}` : "No quests yet",
      );
    }
  });

  it("has no percentage or progress bars", async () => {
    const { container } = render(await AboutPage());
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryAllByRole("meter")).toHaveLength(0);
    expect(container.querySelector("progress, meter")).toBeNull();
    expect(container.textContent).not.toMatch(/\d\s*%/);
  });

  // DESIGN.md: no age signals and no dates anywhere.
  it("shows no age signals and no dates", async () => {
    const { container } = render(await AboutPage());
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\byears?\b|\bsince\b|\bpresent\b|\bage\b/i);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(text).not.toMatch(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w* \d/i);
  });

  it("runs the rank ring unlock animation only under motion-safe", async () => {
    render(await AboutPage());
    const pips = screen.getAllByTestId("rank-segment");
    for (const pip of pips) {
      const classes = (pip.getAttribute("class") ?? "").split(/\s+/);
      expect(classes).not.toContain("animate-pip-unlock");
      if (pip.dataset.lit === "true") expect(classes).toContain("motion-safe:animate-pip-unlock");
      else expect(classes.some((c) => c.includes("animate"))).toBe(false);
    }
  });
});
