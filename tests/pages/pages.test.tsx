import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AboutPage from "@/app/about/page";
import ExperiencePage from "@/app/experience/page";
import HomePage from "@/app/page";
import ProjectPage, { generateMetadata, generateStaticParams } from "@/app/projects/[slug]/page";
import ProjectsPage from "@/app/projects/page";
import experienceData from "@/data/experience.json";
import profileData from "@/data/profile.json";
import projectsData from "@/data/projects.json";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

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
  });

  it("turns the boot-up and pulse animations off under reduced motion", async () => {
    render(await HomePage());
    expect(screen.getByTestId("hero-logo")).toHaveClass(
      "animate-boot",
      "motion-reduce:animate-none",
    );
    expect(screen.getByTestId("press-start")).toHaveClass(
      "animate-cta-pulse",
      "motion-reduce:animate-none",
    );
  });
});

describe("ProjectsPage", () => {
  it("lists every project with a link to its detail page", async () => {
    render(await ProjectsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    for (const project of projectsData) {
      expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
        "href",
        `/projects/${project.slug}`,
      );
    }
  });
});

describe("ProjectPage", () => {
  const project = projectsData[0];

  it("shows the title, technologies and external links", async () => {
    render(await ProjectPage(slugProps(project.slug)));
    expect(screen.getByRole("heading", { level: 1, name: project.title })).toBeInTheDocument();
    const tech = screen.getByRole("list", { name: `Technologies used in ${project.title}` });
    expect(
      within(tech)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(project.tech);
    expect(screen.getByRole("link", { name: "View source code" })).toHaveAttribute(
      "href",
      project.links.repo,
    );
    expect(screen.getByRole("link", { name: "← All projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
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
});

describe("AboutPage", () => {
  it("renders skills and contact links", async () => {
    render(await AboutPage());
    expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeInTheDocument();
    for (const group of profileData.skills) {
      expect(screen.getByText(group.category)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: profileData.email })).toHaveAttribute(
      "href",
      `mailto:${profileData.email}`,
    );
    for (const social of profileData.socials) {
      expect(screen.getByRole("link", { name: social.label })).toHaveAttribute("href", social.url);
    }
  });
});
