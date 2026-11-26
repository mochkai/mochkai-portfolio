import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import { toPublicProject, toPublicProjects } from "@/lib/projects";
import { makeProject, projectFixtures } from "../../tests/fixtures";
import { BoostMeter } from "./BoostMeter";
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
  const publicFixtures = toPublicProjects(projectFixtures);

  it("renders one card per project whose title link goes to its detail page", () => {
    render(<ProjectList projects={publicFixtures} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.getAllByTestId("project-card")).toHaveLength(publicFixtures.length);
    for (const project of publicFixtures) {
      expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
        "href",
        `/projects/${project.slug}`,
      );
    }
  });

  it("makes each card a single stretched link, with no nested links", () => {
    render(<ProjectList projects={publicFixtures} />);
    for (const card of screen.getAllByTestId("project-card")) {
      const links = within(card).getAllByRole("link");
      expect(links).toHaveLength(1);
      // The ::after overlay covers the card; focus draws the ring on it instead of the text.
      expect(links[0]).toHaveClass(
        "after:absolute",
        "after:inset-0",
        "focus-visible:after:outline-neon",
      );
      // The card glows on hover and focus-within.
      expect(card).toHaveAttribute("data-interactive", "true");
      expect(card).toHaveClass("focus-within:shadow-glow", "hover:shadow-glow");
    }
  });

  it("lays the cards out as a responsive grid wrapped in the pointer tilt", () => {
    const { container } = render(<ProjectList projects={publicFixtures} />);
    expect(container.querySelector("ul")).toHaveClass("grid", "sm:grid-cols-2", "lg:grid-cols-3");
    expect(screen.getAllByTestId("tilt-card")).toHaveLength(publicFixtures.length);
  });

  it("uses h3 headings when asked", () => {
    render(
      <ProjectList projects={[toPublicProject(makeProject({ title: "Only" }))]} headingLevel={3} />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Only" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("labels each project's technologies and shows its status and summary", () => {
    const project = toPublicProject(
      makeProject({ title: "Labelled", tech: ["Rust", "Wasm"], summary: "Does a thing." }),
    );
    render(<ProjectList projects={[project]} />);
    const tech = screen.getByRole("list", { name: "Technologies used in Labelled" });
    expect(
      within(tech)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Rust", "Wasm"]);
    expect(screen.getByText("Quest complete")).toBeInTheDocument();
    expect(screen.getByText("Does a thing.")).toBeInTheDocument();
  });

  it("shows an open-ended project as an active quest", () => {
    render(<ProjectList projects={[toPublicProject(makeProject({ endDate: null }))]} />);
    expect(screen.getByText("Active quest")).toBeInTheDocument();
  });

  it("never renders a date, date range or duration", () => {
    const projects = toPublicProjects([
      makeProject({ slug: "a", startDate: "2024-03", endDate: null }),
      makeProject({ slug: "b", startDate: "2021-07", endDate: "2022-02" }),
    ]);
    const { container } = render(<ProjectList projects={projects} />);
    // Raw and formatted dates on the HTML; bare years only on the text (image URLs have numbers).
    const html = container.innerHTML;
    const text = container.textContent ?? "";
    expect(html).not.toMatch(/\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/);
    expect(html).not.toMatch(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w* \d/i);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(text).not.toMatch(/\bpresent\b|\b\d+ (yrs?|years?|mos?|months?)\b/i);
  });

  it("marks images as decorative", () => {
    const { container } = render(<ProjectList projects={[toPublicProject(makeProject())]} />);
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

  it("shows the current page with a filled marker and an underline (non-color cues)", () => {
    pathname.current = "/projects/project-one";
    render(<NavLinks items={items} />);
    const active = screen.getByRole("link", { name: "Projects" });
    const inactive = screen.getByRole("link", { name: "About" });
    // Marker plus underline bar on the current page, marker only elsewhere; all decorative.
    expect(active.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(inactive.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(active.querySelector('[aria-hidden="true"]')).toHaveClass("bg-neon");
    expect(inactive.querySelector('[aria-hidden="true"]')).not.toHaveClass("bg-neon");
  });

  it("turns link transitions off under reduced motion", () => {
    render(<NavLinks items={items} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("duration-150", "motion-reduce:transition-none");
    }
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
      ["Contact", "/about#contact"],
    ]);
    expect(within(nav).getByRole("link", { name: "Experience" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps About as the only current item on /about; Contact is never current", () => {
    pathname.current = "/about";
    render(<SiteHeader name="Ada Fixture" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("keeps every nav item on one row on phones (grid-flow-col, not a fixed column count)", () => {
    render(<SiteHeader name="Ada Fixture" />);
    const list = within(screen.getByRole("navigation", { name: "Main" })).getByRole("list");
    expect(list).toHaveClass("grid-flow-col", "auto-cols-auto");
    expect(list.className).not.toMatch(/(^|\s)grid-cols-/);
    for (const link of within(list).getAllByRole("link")) expect(link).toHaveClass("min-h-11");
  });
});

describe("SiteHeader logo", () => {
  it("shows the logo as a decorative image inside the home link", () => {
    render(<SiteHeader name="Ada Fixture" />);
    const home = screen.getByRole("link", { name: "Ada Fixture" });
    const logo = home.querySelector("img");
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute("alt", "");
    expect(logo?.getAttribute("src")).toContain("logo.svg");
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

  it("hides the rune-line divider from assistive tech", () => {
    render(<SiteFooter name="Ada" socials={[]} />);
    const divider = screen.getByRole("contentinfo").firstElementChild;
    expect(divider).toHaveAttribute("aria-hidden", "true");
  });
});

describe("BoostMeter", () => {
  /** Sets the document size and scroll offset that the meter reads. */
  function setScroll(scrollY: number, scrollHeight = 3000, clientHeight = 1000) {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: scrollHeight,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: clientHeight,
    });
    Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  }

  /** Stubs `matchMedia` so `usePrefersReducedMotion` reports `reduce`. */
  function stubReducedMotion(reduce: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: reduce,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    setScroll(0, 0, 0);
  });

  it("is decorative, ignores the pointer and starts empty at the top", () => {
    setScroll(0);
    render(<BoostMeter />);
    const meter = screen.getByTestId("boost-meter");
    expect(meter).toHaveAttribute("aria-hidden", "true");
    expect(meter).toHaveClass("pointer-events-none", "fixed");
    expect(meter).toHaveAttribute("data-progress", "0.000");
    expect(screen.getByTestId("boost-meter-fill")).toHaveStyle({ transform: "scaleX(0)" });
  });

  it("fills with scroll progress, one update per animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    setScroll(0);
    render(<BoostMeter />);
    const meter = screen.getByTestId("boost-meter");
    const fill = screen.getByTestId("boost-meter-fill");

    setScroll(1000);
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);
    act(() => frames.shift()?.(0));
    expect(meter).toHaveAttribute("data-progress", "0.500");
    expect(fill).toHaveStyle({ transform: "scaleX(0.5)" });

    setScroll(2000);
    fireEvent.scroll(window);
    act(() => frames.shift()?.(0));
    expect(meter).toHaveAttribute("data-progress", "1.000");
    expect(fill).toHaveStyle({ transform: "scaleX(1)" });
  });

  it("eases the fill when motion is allowed", () => {
    stubReducedMotion(false);
    render(<BoostMeter />);
    expect(screen.getByTestId("boost-meter-fill")).toHaveClass("transition-transform");
  });

  it("jumps without easing under reduced motion", () => {
    stubReducedMotion(true);
    render(<BoostMeter />);
    const fill = screen.getByTestId("boost-meter-fill");
    expect(fill).toHaveClass("transition-none");
    expect(fill).not.toHaveClass("transition-transform");
  });

  it("stops listening when unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<BoostMeter />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    remove.mockRestore();
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
    expect(screen.queryByTestId("label-rune")).toBeNull();
  });

  it("shows an optional HUD label above the title", () => {
    render(<PageHeader title="Projects" label="Quest board" />);
    const label = screen.getByText("Quest board");
    expect(label).toHaveClass("font-mono", "uppercase");
    expect(label.compareDocumentPosition(screen.getByRole("heading", { level: 1 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
