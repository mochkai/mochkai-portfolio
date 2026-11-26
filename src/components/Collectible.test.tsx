import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { PROGRESS_STORAGE_KEY, progressStore } from "@/lib/collectible-progress";
import { COLLECTIBLES } from "@/lib/collectibles";
import { Collectible } from "./Collectible";
import { CollectibleCounter } from "./CollectibleCounter";
import { CollectibleToast } from "./CollectibleToast";

afterEach(() => {
  act(() => progressStore.reset());
  localStorage.clear();
});

/** Every class on `element`, split. */
function classesOf(element: Element): string[] {
  return element.getAttribute("class")?.split(/\s+/) ?? [];
}

describe("Collectible", () => {
  it("is a 44 px button named after its number", () => {
    render(<Collectible id="quest-board" />);
    const button = screen.getByRole("button", { name: "Collect rune shard 2 of 5" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("size-11");
    expect(button).not.toHaveAttribute("id");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("collects on click, saves progress and stays focusable once collected", async () => {
    render(<Collectible id="quest-board" />);
    await userEvent.click(screen.getByRole("button", { name: "Collect rune shard 2 of 5" }));
    const collected = screen.getByRole("button", { name: "Rune shard 2 of 5, collected" });
    expect(collected).toHaveAttribute("aria-disabled", "true");
    expect(collected).toHaveAttribute("data-collected", "true");
    expect(collected).toHaveFocus();
    expect(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "")).toEqual(["quest-board"]);

    // A second press changes nothing.
    await userEvent.click(collected);
    expect(progressStore.getSnapshot().found).toEqual(["quest-board"]);
  });

  it("collects with the keyboard (Enter and Space)", async () => {
    render(
      <>
        <Collectible id="title-screen" />
        <Collectible id="quest-loot" />
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(progressStore.getSnapshot().found).toEqual(["title-screen", "quest-loot"]);
  });

  it("puts the collect glow and every transition under motion-safe only", async () => {
    render(<Collectible id="quest-board" />);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    const motion = classesOf(button).filter((name) =>
      /animate-|transition|duration|ease-/.test(name),
    );
    expect(motion).toContain("motion-safe:animate-shard-collect");
    for (const name of motion) expect(name.startsWith("motion-safe:")).toBe(true);

    // jsdom has no AnimationEvent, so React listens for the prefixed name there.
    fireEvent(button, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(classesOf(button)).not.toContain("motion-safe:animate-shard-collect");
  });

  it("renders as not collected on the server, whatever is stored", () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(["quest-board"]));
    const html = renderToString(<Collectible id="quest-board" />);
    expect(html).toContain('aria-label="Collect rune shard 2 of 5"');
    expect(html).toContain('data-collected="false"');
  });
});

describe("CollectibleCounter", () => {
  it("is hidden until the first shard is found, then counts", async () => {
    const { container } = render(
      <>
        <CollectibleCounter />
        <Collectible id="quest-log-end" />
      </>,
    );
    expect(screen.queryByTestId("collectible-counter")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Collect rune shard 4 of 5" }));
    const counter = screen.getByTestId("collectible-counter");
    expect(counter).toHaveTextContent("Runes 1/5");
    expect(counter).toHaveTextContent("Rune shards found: 1 of 5");
    expect(counter).toHaveAttribute("title", `Next rune shard: ${COLLECTIBLES[0].hint}`);
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("renders nothing on the server, so hydration never mismatches", () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(["quest-board"]));
    expect(renderToString(<CollectibleCounter />)).toBe("");
  });
});

describe("CollectibleToast", () => {
  /** Renders every shard plus the toast. */
  function renderAll() {
    return render(
      <>
        {COLLECTIBLES.map((item) => (
          <Collectible key={item.id} id={item.id} />
        ))}
        <CollectibleToast />
      </>,
    );
  }

  /** Collects every shard by clicking it. */
  async function collectAll() {
    for (const item of COLLECTIBLES) {
      await userEvent.click(screen.getByTestId(`collectible-${item.id}`));
    }
  }

  it("announces each collect in an always-present polite live region", async () => {
    renderAll();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    await userEvent.click(screen.getByRole("button", { name: "Collect rune shard 3 of 5" }));
    expect(status).toHaveTextContent(/^Rune shard 3 found\. 1 of 5 collected\. Next: /);
  });

  it("shows a dismissible achievement after the last shard, without moving focus", async () => {
    renderAll();
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
    await collectAll();

    const toast = screen.getByRole("region", { name: "All 5 rune shards found" });
    expect(toast).toHaveTextContent("Achievement unlocked");
    expect(screen.getByRole("status")).toHaveTextContent(/Achievement unlocked/);
    const lastShard = screen.getByRole("button", { name: "Rune shard 5 of 5, collected" });
    expect(lastShard).toHaveFocus();

    // Dismissing from inside the toast returns focus to the shard.
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
    expect(lastShard).toHaveFocus();
    expect(progressStore.getSnapshot().found).toHaveLength(5);
  });

  it("closes on Escape", async () => {
    renderAll();
    await collectAll();
    expect(screen.getByTestId("achievement-toast")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
  });

  it("can reset every shard", async () => {
    renderAll();
    await collectAll();
    await userEvent.click(screen.getByRole("button", { name: "Reset shards" }));
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Rune shards reset/);
    expect(screen.getAllByRole("button", { name: /^Collect rune shard/ })).toHaveLength(5);
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("is fixed to the viewport, with no competing position class", async () => {
    renderAll();
    await collectAll();
    const classes = classesOf(screen.getByTestId("achievement-toast"));
    expect(classes).toContain("fixed");
    for (const position of ["relative", "absolute", "sticky", "static"]) {
      expect(classes).not.toContain(position);
    }
  });

  it("puts its entrance animation under motion-safe only", async () => {
    renderAll();
    await collectAll();
    const motion = classesOf(screen.getByTestId("achievement-toast")).filter((name) =>
      /animate-|transition/.test(name),
    );
    expect(motion).toEqual(["motion-safe:animate-achievement-in"]);
  });
});
