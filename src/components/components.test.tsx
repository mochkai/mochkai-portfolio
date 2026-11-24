import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import { makeProject, projectFixtures } from "../../tests/fixtures";
import { NavLinks } from "./NavLinks";
import { PageHeader } from "./PageHeader";
import { ProjectList } from "./ProjectList";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

afterEach(() => {
  pathname.current = "/";
});

describe("ProjectList", () => {
  it("renders one list item per project with a title link to its detail page", () => {
    render(<ProjectList projects={projectFixtures} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["Beta", "Alpha", "Gamma"]);
    for (const project of projectFixtures) {
      expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
        "href",
        `/projects/${project.slug}`,
      );
    }
  });

  it("uses h3 headings when asked", () => {
    render(<ProjectList projects={[makeProject({ title: "Only" })]} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Only" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("labels each project's technologies and shows its date range and summary", () => {
    const project = makeProject({
      title: "Labelled",
      tech: ["Rust", "Wasm"],
      summary: "Does a thing.",
      startDate: "2024-03",
      endDate: null,
    });
    render(<ProjectList projects={[project]} />);
    const tech = screen.getByRole("list", { name: "Technologies used in Labelled" });
    expect(
      within(tech)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Rust", "Wasm"]);
    expect(screen.getByText("Mar 2024 – Present")).toBeInTheDocument();
    expect(screen.getByText("Does a thing.")).toBeInTheDocument();
  });

  it("marks thumbnails as decorative", () => {
    const { container } = render(<ProjectList projects={[makeProject()]} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", "");
  });

  it("shows an empty state when there are no projects", () => {
    render(<ProjectList projects={[]} />);
    expect(screen.getByText("No projects published yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("NavLinks", () => {
  const items = [
    { href: "/", label: "Home" },
    { href: "/projects", label: "Projects" },
    { href: "/about", label: "About" },
  ];

  it.each([
    ["/", "Home"],
    ["/projects", "Projects"],
    ["/projects/project-one", "Projects"],
    ["/about", "About"],
  ])("on %s marks only %s as the current page", (path, activeLabel) => {
    pathname.current = path;
    render(<NavLinks items={items} />);
    for (const item of items) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
      if (item.label === activeLabel) expect(link).toHaveAttribute("aria-current", "page");
      else expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("does not treat a sibling path with the same prefix as active", () => {
    pathname.current = "/projectsarchive";
    render(<NavLinks items={items} />);
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing on an unrelated page", () => {
    pathname.current = "/experience";
    render(<NavLinks items={items} />);
    for (const link of screen.getAllByRole("link"))
      expect(link).not.toHaveAttribute("aria-current");
  });
});

describe("SiteHeader", () => {
  it("renders a Main navigation landmark with the home link and section links", () => {
    pathname.current = "/experience";
    render(<SiteHeader name="Ada Fixture" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Ada Fixture" })).toHaveAttribute("href", "/");
    expect(
      within(nav)
        .getAllByRole("link")
        .slice(1)
        .map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["Projects", "/projects"],
      ["Experience", "/experience"],
      ["About", "/about"],
    ]);
    expect(within(nav).getByRole("link", { name: "Experience" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("SiteFooter", () => {
  it("renders the name and social links that open safely in a new tab", () => {
    render(
      <SiteFooter
        name="Ada Fixture"
        socials={[
          { label: "GitHub", url: "https://github.com/ada" },
          { label: "Mastodon", url: "https://mastodon.social/@ada" },
        ]}
      />,
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent("© Ada Fixture");
    const list = screen.getByRole("list", { name: "Social links" });
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://github.com/ada",
      "https://mastodon.social/@ada",
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("omits the social list when there are no socials", () => {
    render(<SiteFooter name="Ada" socials={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("PageHeader", () => {
  it("renders an h1 and optional intro", () => {
    const { rerender } = render(
      <PageHeader title="Projects">
        <p>Intro text</p>
      </PageHeader>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("Intro text")).toBeInTheDocument();

    rerender(<PageHeader title="Bare" />);
    expect(screen.getByRole("heading", { level: 1, name: "Bare" })).toBeInTheDocument();
    expect(screen.queryByText("Intro text")).toBeNull();
  });
});

describe("ErrorPage", () => {
  it("shows an alert and calls retry when the button is pressed", async () => {
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={new Error("boom")} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This page failed to load");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("GlobalError", () => {
  it("renders its own document with an alert and calls retry when the button is pressed", async () => {
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("layout failed");
    render(<GlobalError error={error} retry={retry} />);
    // React treats <html> and <body> as singletons and applies them to the document's own.
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.body.querySelector("main")).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});

describe("NotFound", () => {
  it("renders a heading and a link home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });
});
