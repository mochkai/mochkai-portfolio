import { describe, expect, it, vi } from "vitest";
import {
  buildCommands,
  createPaletteStore,
  filterCommands,
  isApplePlatform,
  isPaletteShortcut,
  paletteKeyAction,
  scoreCommand,
  scoreToken,
  type ShortcutKeyPress,
} from "./command-palette";

const commands = buildCommands({
  projects: [
    { slug: "project-one", title: "Project One" },
    { slug: "project-two", title: "Project Two" },
  ],
  email: "you@example.com",
  socials: [
    { label: "GitHub", url: "https://github.com/x" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/x" },
  ],
});

/** Labels of the filtered commands, in display order. */
function labels(query: string): string[] {
  return filterCommands(commands, query).flatMap((section) => section.commands.map((c) => c.label));
}

/** A key press with every flag off. */
function press(overrides: Partial<ShortcutKeyPress>): ShortcutKeyPress {
  return {
    key: "k",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe("buildCommands", () => {
  it("lists every page, every project, copy email and every social link", () => {
    expect(commands.map((c) => [c.group, c.label, c.action])).toEqual([
      ["Pages", "Home", { type: "navigate", href: "/" }],
      ["Pages", "Projects", { type: "navigate", href: "/projects" }],
      ["Pages", "Experience", { type: "navigate", href: "/experience" }],
      ["Pages", "About", { type: "navigate", href: "/about" }],
      ["Pages", "Contact", { type: "navigate", href: "/about#contact" }],
      ["Projects", "Project One", { type: "navigate", href: "/projects/project-one" }],
      ["Projects", "Project Two", { type: "navigate", href: "/projects/project-two" }],
      ["Contact", "Copy email address", { type: "copy", text: "you@example.com" }],
      ["Contact", "GitHub", { type: "external", href: "https://github.com/x" }],
      ["Contact", "LinkedIn", { type: "external", href: "https://www.linkedin.com/in/x" }],
    ]);
  });

  it("has unique, DOM-safe ids", () => {
    const ids = commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("omits Copy email without an address", () => {
    const list = buildCommands({ projects: [], socials: [] });
    expect(list.some((c) => c.action.type === "copy")).toBe(false);
    expect(list).toHaveLength(5);
  });
});

describe("filtering", () => {
  it("lists everything in order for an empty or blank query", () => {
    expect(labels("")).toEqual(commands.map((c) => c.label));
    expect(labels("   ")).toEqual(commands.map((c) => c.label));
  });

  it("matches substrings case-insensitively and ignores diacritics", () => {
    expect(labels("TWO")).toEqual(["Project Two"]);
    expect(labels("éxper")).toEqual(["Experience"]);
  });

  it("matches fuzzy subsequences", () => {
    expect(labels("prtwo")).toEqual(["Project Two"]);
    expect(labels("lnkdn")).toEqual(["LinkedIn"]);
  });

  it("requires every word to match", () => {
    expect(labels("project one")).toEqual(["Project One"]);
    expect(labels("zzz")).toEqual([]);
  });

  it("puts the group with the best match first", () => {
    expect(labels("git")[0]).toBe("GitHub");
    expect(filterCommands(commands, "git")[0].group).toBe("Contact");
  });

  it("matches keywords, weighted below the label", () => {
    expect(labels("email")).toContain("Copy email address");
    const contact = commands.find((c) => c.label === "Contact");
    const copy = commands.find((c) => c.id === "copy-email");
    expect(contact && copy).toBeTruthy();
    if (contact && copy) expect(scoreCommand(contact, "cont")).toBeGreaterThan(0);
  });

  it("finds a word-start occurrence after an earlier mid-word one", () => {
    // "one" first appears inside "phone", then at a word start.
    expect(scoreToken("phone one", "one")).toBe(80);
    expect(scoreToken("phone", "one")).toBe(60);
  });

  it("scores prefix > word start > substring > fuzzy, and 0 for no match", () => {
    expect(scoreToken("project two", "pro")).toBeGreaterThan(scoreToken("project two", "two"));
    expect(scoreToken("project two", "two")).toBeGreaterThan(scoreToken("project two", "jec"));
    expect(scoreToken("project two", "jec")).toBeGreaterThan(scoreToken("project two", "ptw"));
    expect(scoreToken("project two", "xyz")).toBe(0);
  });
});

describe("isPaletteShortcut", () => {
  it("accepts Ctrl+K and Cmd+K, in either case", () => {
    expect(isPaletteShortcut(press({ ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(press({ metaKey: true }))).toBe(true);
    expect(isPaletteShortcut(press({ ctrlKey: true, key: "K" }))).toBe(true);
  });

  it("ignores plain K, other keys and browser combinations", () => {
    expect(isPaletteShortcut(press({}))).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true, key: "j" }))).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true, metaKey: true }))).toBe(false);
  });

  it("ignores claimed presses and IME composition", () => {
    expect(isPaletteShortcut(press({ ctrlKey: true, defaultPrevented: true }))).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true, isComposing: true }))).toBe(false);
  });
});

describe("paletteKeyAction", () => {
  it("moves down and up, wrapping around", () => {
    expect(paletteKeyAction("ArrowDown", 0, 3)).toEqual({ type: "move", index: 1 });
    expect(paletteKeyAction("ArrowDown", 2, 3)).toEqual({ type: "move", index: 0 });
    expect(paletteKeyAction("ArrowUp", 0, 3)).toEqual({ type: "move", index: 2 });
    expect(paletteKeyAction("ArrowUp", 2, 3)).toEqual({ type: "move", index: 1 });
  });

  it("runs the active option on Enter, clamped into range", () => {
    expect(paletteKeyAction("Enter", 1, 3)).toEqual({ type: "run", index: 1 });
    expect(paletteKeyAction("Enter", 9, 3)).toEqual({ type: "run", index: 2 });
  });

  it("leaves other keys and empty lists to the browser", () => {
    expect(paletteKeyAction("Home", 1, 3)).toEqual({ type: "none" });
    expect(paletteKeyAction("a", 1, 3)).toEqual({ type: "none" });
    expect(paletteKeyAction("Enter", 0, 0)).toEqual({ type: "none" });
    expect(paletteKeyAction("ArrowDown", 0, 0)).toEqual({ type: "none" });
  });
});

describe("createPaletteStore", () => {
  it("opens, closes and toggles, notifying only on change", () => {
    const store = createPaletteStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.getServerSnapshot()).toBe(false);
    store.open();
    store.open();
    expect(store.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    store.toggle();
    expect(store.getSnapshot()).toBe(false);
    store.close();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.toggle();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("remembers the trigger until it closes", () => {
    const store = createPaletteStore();
    const button = document.createElement("button");
    store.open(button);
    expect(store.trigger).toBe(button);
    store.close();
    expect(store.trigger).toBeNull();
  });
});

describe("isApplePlatform", () => {
  it("detects macOS and iOS platforms", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("macOS")).toBe(true);
    expect(isApplePlatform("iPhone")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
    expect(isApplePlatform("Linux x86_64")).toBe(false);
  });
});
