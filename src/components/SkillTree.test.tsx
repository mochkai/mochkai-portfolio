import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAYOUT_STORAGE_KEY, layoutStore } from "@/lib/skill-map-layout";
import { buildSkillMap, type SkillTreeBranchInput } from "@/lib/skill-tree";
import { makeProject } from "../../tests/fixtures";
import { SkillTree } from "./SkillTree";

const tree: SkillTreeBranchInput[] = [
  {
    id: "frontend",
    name: "Front end",
    skills: [
      { id: "typescript", name: "TypeScript", rank: "mastered" },
      { id: "react", name: "React", rank: "mastered", requires: ["typescript"] },
      { id: "tailwind-css", name: "Tailwind CSS", rank: "proficient" },
    ],
  },
  {
    id: "ai-dev",
    name: "AI dev",
    skills: [
      { id: "llm-apis", name: "LLM APIs", rank: "proficient" },
      { id: "langgraph", name: "LangGraph", rank: "learning", requires: ["llm-apis"] },
    ],
  },
];

const data = buildSkillMap(tree, [
  makeProject({ tech: ["React", "Tailwind CSS"] }),
  makeProject({ tech: ["React"] }),
]);

/** The component under test with fixed start-node text. */
function Map() {
  return <SkillTree data={data} startTitle="Ada" startSubtitle="Full-stack" />;
}

/** The node button for a skill name. */
function node(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name},`) });
}

/** The map's SVG. */
function svg() {
  return screen.getByTestId("skill-map");
}

/** Width of the current viewBox (smaller means zoomed in). */
function viewWidth() {
  return Number(svg().getAttribute("viewBox")?.split(" ")[2]);
}

/**
 * Stubs `matchMedia` (reduced motion on or off) and a `ResizeObserver` that reports a
 * phone-sized frame, so the viewport goes live as it does in a browser.
 */
function mockBrowser({ reducedMotion = true, width = 340, height = 560 } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reducedMotion && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback(
          [{ contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    },
  );
}

beforeEach(() => {
  // jsdom has no pointer capture.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => layoutStore.set("constellation"));
  localStorage.clear();
});

describe("SkillTree", () => {
  describe("server render", () => {
    it("renders the whole Constellation map with a viewBox that fits it", () => {
      const html = renderToString(<Map />);
      const container = document.createElement("div");
      container.innerHTML = html;
      const map = container.querySelector('[data-testid="skill-map"]');
      expect(map).toHaveAttribute("data-layout", "constellation");
      const { x, y, width, height } = data.layouts.constellation.bounds;
      expect(map).toHaveAttribute("viewBox", `${x} ${y} ${width} ${height}`);
      expect(container.querySelectorAll('[data-testid="skill-start"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-testid="skill-hub"]')).toHaveLength(2);
      expect(container.querySelectorAll('[data-testid="skill-node"]')).toHaveLength(5);
      // Two spokes, one link per skill on a hub (3) and one per requires (2).
      expect(container.querySelectorAll('[data-testid="skill-edge"]')).toHaveLength(7);
      expect(container.querySelectorAll('[data-testid="skill-name"]')).toHaveLength(5);
      expect(container.querySelector('[data-testid="skill-map-logo"]')).not.toBeNull();
    });

    it("hydrates a stored World tree without a mismatch, then shows it", async () => {
      mockBrowser();
      const html = renderToString(<Map />);
      expect(html).toContain('data-layout="constellation"');
      act(() => layoutStore.set("tree"));
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();
      await act(async () => {
        hydrateRoot(container, <Map />, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="skill-map"]')).toHaveAttribute(
        "data-layout",
        "tree",
      );
      container.remove();
    });
  });

  it("names every node: skills with rank and prerequisites, hubs and the start node", () => {
    render(<Map />);
    expect(node("React")).toHaveAccessibleName("React, Mastered, requires TypeScript");
    expect(node("LangGraph")).toHaveAccessibleName("LangGraph, Learning, requires LLM APIs");
    expect(screen.getByRole("button", { name: "Front end branch, 3 skills" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start, 2 branches" })).toBeVisible();
    expect(screen.getByRole("group", { name: "AI dev branch" })).toBeVisible();
    // Every name is always drawn on the map, and the rank ring lights by rank.
    expect(screen.getAllByTestId("skill-name").map((label) => label.textContent)).toEqual([
      "TypeScript",
      "React",
      "Tailwind CSS",
      "LLM APIs",
      "LangGraph",
    ]);
    const lit = (name: string) =>
      within(node(name))
        .getAllByTestId("rank-segment")
        .filter((segment) => segment.dataset.lit === "true").length;
    expect([lit("React"), lit("Tailwind CSS"), lit("LangGraph")]).toEqual([3, 2, 1]);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  describe("layout toggle", () => {
    it("switches layouts and remembers the choice", async () => {
      mockBrowser();
      const user = userEvent.setup();
      render(<Map />);
      const group = screen.getByRole("group", { name: "Map layout" });
      const constellation = within(group).getByRole("button", { name: "Constellation" });
      const worldTree = within(group).getByRole("button", { name: "World tree" });
      expect(constellation).toHaveAttribute("aria-pressed", "true");
      expect(worldTree).toHaveAttribute("aria-pressed", "false");
      await user.click(worldTree);
      expect(worldTree).toHaveAttribute("aria-pressed", "true");
      expect(svg()).toHaveAttribute("data-layout", "tree");
      expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe("tree");
      await user.click(constellation);
      expect(svg()).toHaveAttribute("data-layout", "constellation");
      expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe("constellation");
    });

    it("keeps the selection across a layout switch", async () => {
      mockBrowser();
      const user = userEvent.setup();
      render(<Map />);
      await user.click(node("React"));
      await user.click(screen.getByRole("button", { name: "World tree" }));
      expect(node("React")).toHaveAttribute("data-selected", "true");
      expect(screen.getByTestId("skill-details")).toHaveTextContent("React");
    });
  });

  describe("selection and the details panel", () => {
    it("invites a selection, then shows rank, what it builds on, unlocks and quests", async () => {
      const user = userEvent.setup();
      render(<Map />);
      const details = screen.getByTestId("skill-details");
      expect(details).toHaveTextContent(/Hover, tap or focus a skill/);
      expect(details).not.toHaveAttribute("aria-live");

      await user.click(node("TypeScript"));
      expect(node("TypeScript")).toHaveAttribute("data-selected", "true");
      expect(node("TypeScript")).toHaveFocus();
      expect(within(details).getByRole("heading", { level: 3 })).toHaveTextContent("TypeScript");
      expect(details).toHaveTextContent("Mastered");
      expect(details).toHaveTextContent("First skill in the Front end branch");
      const unlocks = within(details).getByRole("list", { name: "Unlocked by TypeScript" });
      expect(within(unlocks).getByRole("button", { name: "React" })).toBeVisible();
      expect(details).toHaveTextContent("No quests yet");
      expect(within(details).queryByRole("link")).toBeNull();

      await user.click(node("React"));
      expect(details).toHaveTextContent("Builds on TypeScript");
      const link = within(details).getByRole("link", { name: "Used in 2 quests (React)" });
      expect(link).toHaveAttribute("href", "/projects?tech=React");
      expect(screen.getByTestId("skill-details-status")).toHaveAttribute("aria-live", "polite");
      expect(screen.getByTestId("skill-details-status")).toHaveTextContent("Used in 2 quests");
    });

    it("selects and focuses the skill an Unlocks chip names", async () => {
      const user = userEvent.setup();
      render(<Map />);
      await user.click(node("LLM APIs"));
      await user.click(screen.getByRole("button", { name: "LangGraph" }));
      expect(node("LangGraph")).toHaveAttribute("data-selected", "true");
      expect(node("LangGraph")).toHaveFocus();
      expect(screen.getByTestId("skill-details")).toHaveTextContent("Builds on LLM APIs");
    });

    it("lists a hub's skills and the start node's branches", async () => {
      const user = userEvent.setup();
      render(<Map />);
      const details = screen.getByTestId("skill-details");
      await user.click(screen.getByRole("button", { name: "Front end branch, 3 skills" }));
      expect(details).toHaveTextContent("3 skills in this branch.");
      expect(
        within(within(details).getByRole("list", { name: "Front end skills" }))
          .getAllByRole("button")
          .map((chip) => chip.textContent),
      ).toEqual(["TypeScript", "React", "Tailwind CSS"]);

      await user.click(screen.getByRole("button", { name: "Start, 2 branches" }));
      expect(within(details).getByRole("heading", { level: 3 })).toHaveTextContent("Ada");
      expect(details).toHaveTextContent("Full-stack. Every branch starts here.");
      const branches = within(details).getByRole("list", { name: "Branches" });
      await user.click(within(branches).getByRole("button", { name: "AI dev" }));
      expect(screen.getByRole("button", { name: "AI dev branch, 2 skills" })).toHaveAttribute(
        "data-selected",
        "true",
      );
    });
  });

  describe("path highlighting", () => {
    it("previews the path back to the start node on mouse hover only", () => {
      render(<Map />);
      fireEvent.pointerEnter(node("React"), { pointerType: "mouse" });
      expect(node("React")).toHaveAttribute("data-on-path", "true");
      expect(node("TypeScript")).toHaveAttribute("data-on-path", "true");
      expect(node("Tailwind CSS")).toHaveAttribute("data-on-path", "false");
      expect(screen.getByRole("button", { name: /^Front end branch/ })).toHaveAttribute(
        "data-on-path",
        "true",
      );
      expect(screen.getByRole("button", { name: /^Start/ })).toHaveAttribute(
        "data-on-path",
        "true",
      );
      const lit = screen
        .getAllByTestId("skill-edge")
        .filter((edge) => edge.dataset.lit === "true")
        .map((edge) => `${edge.dataset.from}>${edge.dataset.to}`);
      expect(lit).toEqual(["@start>@hub-frontend", "@hub-frontend>typescript", "typescript>react"]);
      // The flowing dash and the power-up only run when motion is allowed.
      for (const flow of screen.getAllByTestId("skill-flow")) {
        expect(flow.getAttribute("class")).toContain("motion-safe:animate-skill-flow");
      }
      expect(screen.getByTestId("skill-path").getAttribute("class")).toBe(
        "motion-safe:animate-path-charge",
      );

      fireEvent.pointerLeave(node("React"), { pointerType: "mouse" });
      expect(node("React")).toHaveAttribute("data-on-path", "false");
      expect(screen.queryByTestId("skill-path")).toBeNull();

      // A touch "hover" does nothing: the tap that follows selects instead.
      fireEvent.pointerEnter(node("React"), { pointerType: "touch" });
      expect(node("React")).toHaveAttribute("data-on-path", "false");
    });
  });

  describe("keyboard", () => {
    it("is one Tab stop with arrow-key roving focus that selects as it moves", async () => {
      const user = userEvent.setup();
      render(<Map />);
      const start = screen.getByRole("button", { name: /^Start/ });
      expect(start).toHaveAttribute("tabindex", "0");
      expect(node("React")).toHaveAttribute("tabindex", "-1");
      // Past the two layout buttons, the two zoom buttons and the two view buttons, Tab lands
      // on the start node.
      for (let i = 0; i < 7; i++) await user.tab();
      expect(start).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("button", { name: /^Front end branch/ })).toHaveFocus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(node("React")).toHaveFocus();
      expect(node("React")).toHaveAttribute("data-selected", "true");
      expect(node("React")).toHaveAttribute("tabindex", "0");
      await user.keyboard("{End}");
      expect(node("LangGraph")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(start).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(node("LangGraph")).toHaveFocus();
    });

    it("zooms with + and −, and 0 returns to the start view, while the map has focus", async () => {
      mockBrowser();
      const user = userEvent.setup();
      render(<Map />);
      const initial = viewWidth();
      node("React").focus();
      await user.keyboard("+");
      expect(viewWidth()).toBeLessThan(initial);
      await user.keyboard("-");
      await user.keyboard("-");
      expect(viewWidth()).toBeGreaterThan(initial);
      await user.keyboard("0");
      expect(viewWidth()).toBeCloseTo(initial, 1);
    });
  });

  describe("pan and zoom", () => {
    it("opens zoomed to a readable scale on a phone-sized frame", () => {
      mockBrowser();
      render(<Map />);
      const { width } = data.layouts.constellation.bounds;
      expect(viewWidth()).toBeLessThan(width);
      // 340 px wide frame at 10.5 / 13 px per unit.
      expect(viewWidth()).toBeCloseTo(340 / (10.5 / 13), 0);
    });

    it("pans on drag without selecting, and a press without movement selects", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const before = svg().getAttribute("viewBox");
      const target = node("React");
      fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(surface, {
        pointerId: 1,
        pointerType: "mouse",
        buttons: 1,
        clientX: 140,
        clientY: 130,
      });
      expect(surface).toHaveAttribute("data-dragging", "true");
      fireEvent.pointerUp(surface, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 140,
        clientY: 130,
      });
      fireEvent.click(target);
      expect(svg().getAttribute("viewBox")).not.toBe(before);
      expect(target).toHaveAttribute("data-selected", "false");
      expect(surface).toHaveAttribute("data-dragging", "false");

      // A press that moves less than the threshold is a click.
      fireEvent.pointerDown(target, {
        pointerId: 2,
        pointerType: "mouse",
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(surface, {
        pointerId: 2,
        pointerType: "mouse",
        buttons: 1,
        clientX: 102,
        clientY: 101,
      });
      fireEvent.pointerUp(target, {
        pointerId: 2,
        pointerType: "mouse",
        clientX: 102,
        clientY: 101,
      });
      fireEvent.click(target);
      expect(target).toHaveAttribute("data-selected", "true");
    });

    it("forgets a press released outside the map: a later hover does not pan", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const target = node("React");
      const press = { pointerId: 7, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 };
      // Released over the page, outside the surface, before the drag threshold: the surface
      // never sees the pointerup.
      fireEvent.pointerDown(target, press);
      fireEvent.pointerUp(window, { ...press, buttons: 0 });
      const before = svg().getAttribute("viewBox");
      fireEvent.pointerMove(surface, { ...press, buttons: 0, clientX: 200, clientY: 160 });
      expect(svg().getAttribute("viewBox")).toBe(before);
      // The next real click still selects.
      fireEvent.pointerDown(target, { ...press, pointerId: 8 });
      fireEvent.pointerUp(target, { ...press, pointerId: 8 });
      fireEvent.click(target);
      expect(target).toHaveAttribute("data-selected", "true");
    });

    it("ignores a stale press even without the window release (no button down on move)", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const press = { pointerId: 3, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 };
      fireEvent.pointerDown(surface, press);
      const before = svg().getAttribute("viewBox");
      fireEvent.pointerMove(surface, { ...press, buttons: 0, clientX: 220, clientY: 180 });
      expect(svg().getAttribute("viewBox")).toBe(before);
      expect(surface).toHaveAttribute("data-dragging", "false");
    });

    it("keeps panning when a child node loses its implicit capture to the surface", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const target = node("React");
      const finger = { pointerId: 21, pointerType: "touch", buttons: 1 };
      fireEvent.pointerDown(target, { ...finger, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(surface, { ...finger, clientX: 130, clientY: 100 });
      // Chrome had captured the touch to the node; the surface taking it fires this on the node.
      fireEvent.lostPointerCapture(target, finger);
      const midway = Number(svg().getAttribute("viewBox")?.split(" ")[0]);
      fireEvent.pointerMove(surface, { ...finger, clientX: 190, clientY: 100 });
      const after = Number(svg().getAttribute("viewBox")?.split(" ")[0]);
      // Another 60 px of finger travel moves the view another 60 px worth of map units.
      const scale = 340 / viewWidth();
      expect((midway - after) * scale).toBeCloseTo(60, 0);
      expect(surface).toHaveAttribute("data-dragging", "true");
      fireEvent.pointerUp(surface, { ...finger, clientX: 190, clientY: 100 });
    });

    it("lets a touch drag after a lost capture pan instead of pinching", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const finger = { pointerType: "touch", clientX: 100, clientY: 100 };
      fireEvent.pointerDown(surface, { ...finger, pointerId: 11 });
      fireEvent.lostPointerCapture(surface, { ...finger, pointerId: 11 });
      const before = viewWidth();
      fireEvent.pointerDown(surface, { ...finger, pointerId: 12 });
      fireEvent.pointerMove(surface, { ...finger, pointerId: 12, clientX: 160, clientY: 140 });
      fireEvent.pointerUp(surface, { ...finger, pointerId: 12, clientX: 160, clientY: 140 });
      // A pan keeps the scale; a pinch with a stale finger would have changed it.
      expect(viewWidth()).toBeCloseTo(before, 3);
      expect(svg().getAttribute("viewBox")).not.toBeNull();
    });

    it("zooms with the buttons and Full view fits the whole map", async () => {
      mockBrowser();
      const user = userEvent.setup();
      render(<Map />);
      const initial = viewWidth();
      await user.click(screen.getByRole("button", { name: "Zoom in" }));
      expect(viewWidth()).toBeLessThan(initial);
      await user.click(screen.getByRole("button", { name: "Full view" }));
      const { width } = data.layouts.constellation.bounds;
      expect(viewWidth()).toBeCloseTo(width, 0);
      await user.click(screen.getByRole("button", { name: "Centre" }));
      expect(viewWidth()).toBeCloseTo(initial, 1);
    });

    it("zooms with Ctrl + wheel but lets a plain wheel scroll the page", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const initial = viewWidth();
      const plain = new WheelEvent("wheel", { deltaY: -100, cancelable: true, bubbles: true });
      act(() => {
        surface.dispatchEvent(plain);
      });
      expect(plain.defaultPrevented).toBe(false);
      expect(viewWidth()).toBe(initial);
      const zoom = new WheelEvent("wheel", {
        deltaY: -100,
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      });
      act(() => {
        surface.dispatchEvent(zoom);
      });
      expect(zoom.defaultPrevented).toBe(true);
      expect(viewWidth()).toBeLessThan(initial);
    });

    it("returns to the start view on a double tap on empty space", () => {
      mockBrowser();
      render(<Map />);
      const surface = screen.getByTestId("skill-map-surface");
      const initial = viewWidth();
      act(() => {
        screen.getByRole("button", { name: "Zoom in" }).click();
      });
      expect(viewWidth()).toBeLessThan(initial);
      for (const pointerId of [1, 2]) {
        fireEvent.pointerDown(surface, {
          pointerId,
          pointerType: "touch",
          clientX: 20,
          clientY: 20,
        });
        fireEvent.pointerUp(surface, { pointerId, pointerType: "touch", clientX: 20, clientY: 20 });
      }
      expect(viewWidth()).toBeCloseTo(initial, 1);
    });
  });
});
