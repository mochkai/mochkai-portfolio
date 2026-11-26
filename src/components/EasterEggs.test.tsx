import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KONAMI_SEQUENCE } from "@/lib/konami";
import { OVERDRIVE_MS, overdriveStore } from "@/lib/overdrive";
import { BoostMeter } from "./BoostMeter";
import {
  CONSOLE_GREETING,
  EGG_TOAST_MS,
  EasterEggs,
  LOGO_EGG_ATTRIBUTE,
  resetGreetingForTests,
} from "./EasterEggs";

/** The sequence as `user-event` key names. */
const CODE_KEYS = KONAMI_SEQUENCE.map((key) => (key.length === 1 ? key : `{${key}}`)).join("");

/** Presses every key of the sequence on `target` (the body by default) with plain key events. */
function pressCode(target: Element = document.body, keys: readonly string[] = KONAMI_SEQUENCE) {
  for (const key of keys) fireEvent.keyDown(target, { key });
}

/** The class list of an element as an array. */
function classesOf(element: Element): string[] {
  return [...element.classList];
}

/** Makes `document.querySelector("dialog:modal")` report an open modal (jsdom has none). */
function fakeModalOpen() {
  const query = document.querySelector.bind(document);
  const modal = document.createElement("dialog");
  vi.spyOn(document, "querySelector").mockImplementation((selector: string) =>
    selector === "dialog:modal" ? modal : query(selector),
  );
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetGreetingForTests();
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  act(() => overdriveStore.stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EasterEggs: secret input", () => {
  it("engages overdrive and shows a toast after the full sequence", async () => {
    render(
      <>
        <BoostMeter />
        <EasterEggs />
      </>,
    );
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    await userEvent.keyboard(CODE_KEYS);

    const toast = screen.getByRole("region", { name: "Overdrive engaged" });
    expect(toast).toHaveTextContent("Cheat code accepted");
    expect(screen.getByTestId("easter-egg-status")).toHaveTextContent(
      "Cheat code accepted. Overdrive engaged for a few seconds.",
    );
    expect(overdriveStore.getSnapshot()).toBe(true);
    expect(screen.getByTestId("boost-meter")).toHaveAttribute("data-overdrive", "true");
  });

  it("never moves focus", async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <EasterEggs />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    await userEvent.keyboard(CODE_KEYS);
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
  });

  it("ignores partial and wrong sequences", () => {
    render(<EasterEggs />);
    pressCode(document.body, KONAMI_SEQUENCE.slice(0, 9));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    pressCode(document.body, [...KONAMI_SEQUENCE.slice(0, 8), "a", "b"]);
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(overdriveStore.getSnapshot()).toBe(false);
  });

  it("ignores typing in inputs, textareas and contenteditable regions", async () => {
    render(
      <>
        <label>
          Name <input />
        </label>
        <label>
          Message <textarea />
        </label>
        <div contentEditable suppressContentEditableWarning data-testid="editable">
          Notes
        </div>
        <EasterEggs />
      </>,
    );
    await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.keyboard(CODE_KEYS);
    await userEvent.click(screen.getByRole("textbox", { name: "Message" }));
    await userEvent.keyboard(CODE_KEYS);
    pressCode(screen.getByTestId("editable"));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(overdriveStore.getSnapshot()).toBe(false);
  });

  it("ignores modifier combinations and auto-repeat", () => {
    render(<EasterEggs />);
    for (const flag of ["ctrlKey", "altKey", "metaKey", "shiftKey", "repeat"]) {
      for (const key of KONAMI_SEQUENCE) fireEvent.keyDown(document.body, { key, [flag]: true });
    }
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
  });

  it("never prevents the default action of a key (arrows keep scrolling)", () => {
    render(<EasterEggs />);
    for (const key of KONAMI_SEQUENCE) {
      expect(fireEvent.keyDown(document.body, { key })).toBe(true);
    }
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
  });
});

describe("EasterEggs: toast and effect lifetime", () => {
  it("ends overdrive on its own and closes the toast after EGG_TOAST_MS", () => {
    vi.useFakeTimers();
    render(<EasterEggs />);
    pressCode();
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(OVERDRIVE_MS));
    expect(overdriveStore.getSnapshot()).toBe(false);
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS - OVERDRIVE_MS));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
  });

  it("stays up while hovered", () => {
    vi.useFakeTimers();
    render(<EasterEggs />);
    pressCode();
    fireEvent.mouseEnter(screen.getByTestId("easter-egg-toast"));
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS * 2));
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId("easter-egg-toast"));
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
  });

  it("stays up while focus is inside, even after the mouse passes over and leaves", () => {
    vi.useFakeTimers();
    render(<EasterEggs />);
    pressCode();
    const toastEl = screen.getByTestId("easter-egg-toast");
    act(() => screen.getByRole("button", { name: "Dismiss" }).focus());
    fireEvent.mouseEnter(toastEl);
    fireEvent.mouseLeave(toastEl);
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS * 2));
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();
  });

  it("stays paused when focus leaves while the toast is still hovered", () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Elsewhere</button>
        <EasterEggs />
      </>,
    );
    pressCode();
    const toastEl = screen.getByTestId("easter-egg-toast");
    act(() => screen.getByRole("button", { name: "Dismiss" }).focus());
    fireEvent.mouseEnter(toastEl);
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS * 2));
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    fireEvent.mouseLeave(toastEl);
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
  });

  it("restores focus when it auto-closes while focus is inside", () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Elsewhere</button>
        <EasterEggs />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    act(() => elsewhere.focus());
    pressCode();
    const toastEl = screen.getByTestId("easter-egg-toast");
    // Focus inside, then a blur with no related target (for example the window losing focus)
    // unpauses it while focus is still inside: the auto-close must hand focus back.
    act(() => screen.getByRole("button", { name: "Dismiss" }).focus());
    fireEvent.blur(toastEl, { relatedTarget: null });
    act(() => vi.advanceTimersByTime(EGG_TOAST_MS));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(elsewhere).toHaveFocus();
  });

  it("sits at the top on phones and bottom-left from sm, using only non-conflicting positions", () => {
    render(<EasterEggs />);
    pressCode();
    const classes = classesOf(screen.getByTestId("easter-egg-toast"));
    expect(classes).toEqual(
      expect.arrayContaining(["fixed", "top-4", "sm:top-auto", "sm:bottom-6", "sm:left-6"]),
    );
    expect(classes).not.toContain("bottom-4");
  });

  it("can be dismissed, which also ends overdrive, and returns focus", async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <EasterEggs />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    await userEvent.keyboard(CODE_KEYS);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(overdriveStore.getSnapshot()).toBe(false);
    expect(elsewhere).toHaveFocus();
  });

  it("ignores Escape while a modal dialog (the command palette) is open or it was claimed", async () => {
    render(<EasterEggs />);
    await userEvent.keyboard(CODE_KEYS);
    const claimed = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    claimed.preventDefault();
    document.dispatchEvent(claimed);
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    fakeModalOpen();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("easter-egg-toast")).toBeInTheDocument();
    expect(overdriveStore.getSnapshot()).toBe(true);
  });

  it("closes on Escape", async () => {
    render(<EasterEggs />);
    await userEvent.keyboard(CODE_KEYS);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(overdriveStore.getSnapshot()).toBe(false);
  });

  it("is fixed to the viewport, with no competing position class", () => {
    render(<EasterEggs />);
    pressCode();
    const classes = classesOf(screen.getByTestId("easter-egg-toast"));
    expect(classes).toContain("fixed");
    for (const position of ["relative", "absolute", "sticky", "static"]) {
      expect(classes).not.toContain(position);
    }
  });
});

describe("EasterEggs: reduced motion", () => {
  it("puts the toast entrance under motion-safe only", () => {
    render(<EasterEggs />);
    pressCode();
    const motion = classesOf(screen.getByTestId("easter-egg-toast")).filter((name) =>
      /animate-|transition/.test(name),
    );
    expect(motion).toEqual(["motion-safe:animate-egg-toast-in"]);
  });

  it("gives the boost meter a static color change, with the surge under motion-safe only", () => {
    render(
      <>
        <BoostMeter />
        <EasterEggs />
      </>,
    );
    pressCode();
    const fill = screen.getByTestId("boost-meter-fill");
    const classes = classesOf(fill);
    // Static (reduced-motion safe) part: brighter fill and stronger glow.
    expect(classes).toEqual(expect.arrayContaining(["brightness-150", "shadow-glow-lg"]));
    expect(classes).not.toContain("shadow-glow-sm");
    // Every animation is behind motion-safe:, never a base class.
    const animations = classes.filter((name) => name.includes("animate-"));
    expect(animations).toEqual(["motion-safe:animate-overdrive-surge"]);
    expect(screen.getByTestId("boost-meter")).toHaveClass("bg-neon/25");
    expect(screen.getByTestId("boost-meter")).not.toHaveClass("bg-surface-raised/80");
  });
});

describe("EasterEggs: logo clicks", () => {
  it("shows a message after five quick clicks on the logo link, without blocking it", () => {
    render(
      <>
        <a href="#home" data-easter-egg={LOGO_EGG_ATTRIBUTE}>
          <span>Logo</span>
        </a>
        <EasterEggs />
      </>,
    );
    const logo = screen.getByText("Logo");
    for (let i = 0; i < 4; i++) expect(fireEvent.click(logo)).toBe(true);
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
    expect(fireEvent.click(logo)).toBe(true);
    expect(screen.getByRole("region", { name: "Logo fully charged" })).toBeInTheDocument();
    expect(screen.getByTestId("easter-egg-status")).toHaveTextContent(/logo fully charged/);
    // Only the logo egg: no overdrive.
    expect(overdriveStore.getSnapshot()).toBe(false);
  });

  it("ignores clicks elsewhere", () => {
    render(
      <>
        <button type="button">Other</button>
        <EasterEggs />
      </>,
    );
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(screen.queryByTestId("easter-egg-toast")).toBeNull();
  });
});

describe("EasterEggs: console greeting and SSR", () => {
  it("greets developers once per page load", () => {
    const { unmount } = render(<EasterEggs />);
    unmount();
    render(<EasterEggs />);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(CONSOLE_GREETING);
  });

  it("renders only an empty live region on the server", () => {
    const html = renderToString(<EasterEggs />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("easter-egg-toast");
    expect(info).not.toHaveBeenCalled();
  });
});
