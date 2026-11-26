import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCommands, paletteStore } from "@/lib/command-palette";
import { CommandPalette } from "./CommandPalette";
import { CommandPaletteButton } from "./CommandPaletteButton";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const commands = buildCommands({
  projects: [
    { slug: "project-one", title: "Project One" },
    { slug: "project-two", title: "Project Two" },
  ],
  email: "you@example.com",
  socials: [{ label: "GitHub", url: "https://github.com/x" }],
});

beforeAll(() => {
  // jsdom has no modal dialogs: emulate showModal / close and the `close` event.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => push.mockReset());

afterEach(() => {
  act(() => paletteStore.close());
  vi.restoreAllMocks();
});

/** Renders the header button and the palette, as in the layout. */
function renderPalette() {
  return render(
    <>
      <CommandPaletteButton />
      <CommandPalette commands={commands} />
    </>,
  );
}

/** The palette dialog (hidden from the a11y tree while closed). */
function dialog() {
  return screen.getByTestId("command-palette") as HTMLDialogElement;
}

/** The combobox input. */
function input() {
  return within(dialog()).getByRole("combobox", { hidden: true });
}

/** Presses Ctrl+K on `target`. */
function ctrlK(target: Element = document.body) {
  return fireEvent.keyDown(target, { key: "k", ctrlKey: true });
}

describe("CommandPalette", () => {
  it("renders closed on the server and the button shows Ctrl K", () => {
    const html = renderToString(
      <>
        <CommandPaletteButton />
        <CommandPalette commands={commands} />
      </>,
    );
    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(html).toContain("Ctrl K");
  });

  it("opens with Ctrl+K and Cmd+K, focusing the combobox, and prevents the default", () => {
    renderPalette();
    expect(dialog().open).toBe(false);
    const notCancelled = ctrlK();
    expect(notCancelled).toBe(false);
    expect(dialog().open).toBe(true);
    expect(input()).toHaveFocus();
    act(() => paletteStore.close());
    expect(dialog().open).toBe(false);
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    expect(dialog().open).toBe(true);
  });

  it("leaves other key presses alone", () => {
    renderPalette();
    expect(fireEvent.keyDown(document.body, { key: "k" })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: "k", ctrlKey: true, shiftKey: true })).toBe(
      true,
    );
    expect(dialog().open).toBe(false);
  });

  it("does not fire, or prevent the default, while focus is in another editable field", () => {
    render(
      <>
        <input aria-label="Other field" />
        <textarea aria-label="Notes" />
        <select aria-label="Pick">
          <option>One</option>
        </select>
        <div contentEditable suppressContentEditableWarning aria-label="Editor" role="textbox" />
        <CommandPalette commands={commands} />
      </>,
    );
    for (const name of ["Other field", "Notes", "Pick", "Editor"]) {
      const field = screen.getByLabelText(name);
      field.focus();
      expect(ctrlK(field), `${name}: default not prevented`).toBe(true);
      expect(dialog().open, `${name}: palette stays closed`).toBe(false);
    }
  });

  it("Ctrl+K in the palette's own input closes it", () => {
    renderPalette();
    ctrlK();
    expect(ctrlK(input())).toBe(false);
    expect(dialog().open).toBe(false);
  });

  it("does not claim the shortcut while another modal dialog is open", () => {
    render(
      <>
        <dialog open aria-label="Other" data-testid="other" />
        <CommandPalette commands={commands} />
      </>,
    );
    // jsdom cannot show a real modal; report the other dialog as `:modal`.
    const other = screen.getByTestId("other");
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector) {
      return selector === ":modal" ? this === other : matches.call(this, selector);
    });
    expect(ctrlK()).toBe(true);
    expect(dialog().open).toBe(false);
  });

  it("is a labelled dialog with the combobox / listbox pattern", () => {
    renderPalette();
    ctrlK();
    const box = dialog();
    expect(box).toHaveAccessibleName("Fast travel");
    const combo = input();
    const listbox = within(box).getByRole("listbox");
    expect(combo).toHaveAttribute("aria-controls", listbox.id);
    expect(combo).toHaveAttribute("aria-expanded", "true");
    expect(combo).toHaveAttribute("aria-autocomplete", "list");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(commands.length);
    expect(combo).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(within(listbox).getByRole("group", { name: "Projects" })).toBeInTheDocument();
    // Ids are unique.
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters as you type, moves with the arrows and navigates to a project on Enter", async () => {
    const user = userEvent.setup();
    renderPalette();
    ctrlK();
    await user.type(input(), "two");
    const options = within(dialog()).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining("Project Two")]);
    await user.clear(input());
    await user.type(input(), "project");
    await user.keyboard("{ArrowDown}");
    const active = document.getElementById(input().getAttribute("aria-activedescendant") ?? "");
    expect(active).toHaveAttribute("aria-selected", "true");
    await user.clear(input());
    await user.type(input(), "project one");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/projects/project-one");
    expect(dialog().open).toBe(false);
  });

  it("wraps from the first option to the last with ArrowUp", async () => {
    const user = userEvent.setup();
    renderPalette();
    ctrlK();
    await user.keyboard("{ArrowUp}");
    const options = within(dialog()).getAllByRole("option");
    expect(input()).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);
  });

  it("shows a message when nothing matches", async () => {
    const user = userEvent.setup();
    renderPalette();
    ctrlK();
    await user.type(input(), "zzzz");
    expect(within(dialog()).queryAllByRole("option")).toHaveLength(0);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).not.toHaveAttribute("aria-activedescendant");
    expect(dialog()).toHaveTextContent("Nothing matches");
  });

  it("opens social links in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    renderPalette();
    ctrlK();
    await user.click(within(dialog()).getByRole("option", { name: /GitHub/ }));
    expect(open).toHaveBeenCalledWith("https://github.com/x", "_blank", "noopener,noreferrer");
    expect(dialog().open).toBe(false);
  });

  it("copies the email and stays open to show the result", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPalette();
    ctrlK();
    await user.click(within(dialog()).getByRole("option", { name: /Copy email address/ }));
    expect(writeText).toHaveBeenCalledWith("you@example.com");
    expect(dialog().open).toBe(true);
    expect(screen.getByTestId("command-status")).toHaveTextContent("Email address copied");
  });

  it("shows the address when copying is not available", async () => {
    const user = userEvent.setup();
    // After setup: user-event installs its own clipboard stub.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    renderPalette();
    ctrlK();
    await user.click(within(dialog()).getByRole("option", { name: /Copy email address/ }));
    expect(screen.getByTestId("command-status")).toHaveTextContent("you@example.com");
  });

  it("the header button opens it and focus returns there on close", async () => {
    const user = userEvent.setup();
    renderPalette();
    const button = screen.getByRole("button", { name: "Fast travel" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(button);
    expect(dialog().open).toBe(true);
    expect(input()).toHaveFocus();
    await user.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(dialog().open).toBe(false);
    expect(button).toHaveFocus();
  });

  it("closes on a backdrop click and on Ctrl+K again, resetting the query", async () => {
    const user = userEvent.setup();
    renderPalette();
    ctrlK();
    await user.type(input(), "two");
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
    ctrlK();
    expect(input()).toHaveValue("");
    ctrlK(input());
    expect(dialog().open).toBe(false);
  });

  it("a drag that starts in the panel and ends on the backdrop does not close it", () => {
    renderPalette();
    ctrlK();
    // Selecting text: press in the input, release outside the panel (the click lands on the dialog).
    fireEvent.pointerDown(input());
    fireEvent.click(dialog());
    expect(dialog().open).toBe(true);
    // A real backdrop click: press and release on the dialog box itself.
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });

  it("a click inside the panel does not close it", () => {
    renderPalette();
    ctrlK();
    fireEvent.click(input());
    expect(dialog().open).toBe(true);
  });

  it("animates only under motion-safe", () => {
    renderPalette();
    const classes = dialog().className.split(/\s+/);
    const animated = classes.filter((c) => c.includes("animate-"));
    expect(animated.length).toBeGreaterThan(0);
    for (const c of animated) expect(c.startsWith("motion-safe:")).toBe(true);
    expect(classes.some((c) => /(^|:)transition/.test(c) && !c.startsWith("motion-safe:"))).toBe(
      false,
    );
  });
});
