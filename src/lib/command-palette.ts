/**
 * The Ctrl+K / Cmd+K "fast travel" command palette (#14): the command list, filtering, keyboard
 * handling and the tiny open/closed store shared by the palette and its header button.
 *
 * Everything here is pure (and serializable, so the layout can build the commands on the server)
 * except {@link paletteStore}, which only remembers which element opened the palette.
 */

/** What running a command does. Plain data, so it can be passed from a Server Component. */
export type CommandAction =
  /** Client-side navigation to a site path (`/projects`, `/about#contact`, ...). */
  | { type: "navigate"; href: string }
  /** Opens an external `http(s)` URL in a new tab. */
  | { type: "external"; href: string }
  /** Copies `text` to the clipboard (the palette stays open to show the result). */
  | { type: "copy"; text: string };

/** The groups, in their default display order. */
export const COMMAND_GROUPS = ["Pages", "Projects", "Contact"] as const;

/** A command group name. */
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

/** One palette entry. */
export interface PaletteCommand {
  /** Unique within the list; used for the option's DOM id. Letters, digits and `-` only. */
  id: string;
  /** Visible text, also the main thing the filter matches. */
  label: string;
  /** Group heading the command is listed under. */
  group: CommandGroup;
  /** Extra words the filter matches (never shown). */
  keywords: readonly string[];
  /** What the command does. */
  action: CommandAction;
}

/** The site pages, in navigation order. "Contact" is the section at the end of About. */
export const PAGE_COMMANDS: readonly { label: string; href: string; keywords: string[] }[] = [
  { label: "Home", href: "/", keywords: ["start", "title"] },
  { label: "Projects", href: "/projects", keywords: ["quests", "work"] },
  { label: "Experience", href: "/experience", keywords: ["quest log", "jobs", "career"] },
  { label: "About", href: "/about", keywords: ["skills", "character"] },
  { label: "Contact", href: "/about#contact", keywords: ["join the party", "email", "hire"] },
];

/** Input for {@link buildCommands}: real content from `getRepository()`, never invented. */
export interface BuildCommandsInput {
  /** Every project (only the slug and title are used, so no dates reach the client). */
  projects: readonly { slug: string; title: string }[];
  /** `profile.email`; without it there is no "Copy email" command. */
  email?: string;
  /** `profile.socials`. */
  socials: readonly { label: string; url: string }[];
}

/**
 * Builds the palette's commands from the site content: one per page, one per project (opening
 * its detail page), "Copy email" when there is an address, and one per social link.
 *
 * @param input - Projects, email and socials from the repository.
 * @returns The commands, grouped in {@link COMMAND_GROUPS} order.
 */
export function buildCommands({ projects, email, socials }: BuildCommandsInput): PaletteCommand[] {
  const pages: PaletteCommand[] = PAGE_COMMANDS.map((page) => ({
    id: `page-${page.label.toLowerCase()}`,
    label: page.label,
    group: "Pages",
    keywords: page.keywords,
    action: { type: "navigate", href: page.href },
  }));
  const projectCommands: PaletteCommand[] = projects.map((project) => ({
    id: `project-${project.slug}`,
    label: project.title,
    group: "Projects",
    keywords: ["project", "quest"],
    action: { type: "navigate", href: `/projects/${project.slug}` },
  }));
  const contact: PaletteCommand[] = [];
  if (email) {
    contact.push({
      id: "copy-email",
      label: "Copy email address",
      group: "Contact",
      keywords: ["mail", "contact", email],
      action: { type: "copy", text: email },
    });
  }
  socials.forEach((social, index) => {
    contact.push({
      id: `social-${index}`,
      label: social.label,
      group: "Contact",
      keywords: ["social", "profile", "contact"],
      action: { type: "external", href: social.url },
    });
  });
  return [...pages, ...projectCommands, ...contact];
}

/** Lowercases and strips diacritics, so "Proyecto" matches "proyécto". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Scores how well one query token matches one piece of text.
 *
 * Prefix beats word start beats substring beats a fuzzy in-order subsequence ("prtwo" matches
 * "Project Two"); a tighter subsequence scores higher.
 *
 * @param text - Normalized text to search.
 * @param token - Normalized, non-empty query token.
 * @returns A score above 0, or 0 when the token does not match.
 */
export function scoreToken(text: string, token: string): number {
  if (text.startsWith(token)) return 100;
  // Any occurrence at a word start wins over a mid-word one ("one" in "phone one").
  let index = text.indexOf(token);
  if (index > 0) {
    while (index > 0) {
      if (/[^a-z0-9]/.test(text[index - 1])) return 80;
      index = text.indexOf(token, index + 1);
    }
    return 60;
  }
  // Fuzzy: every character of the token, in order.
  let position = -1;
  let first = -1;
  for (const char of token) {
    position = text.indexOf(char, position + 1);
    if (position === -1) return 0;
    if (first === -1) first = position;
  }
  const span = position - first + 1;
  // 10 to 40: the closer the characters sit together, the better.
  return 10 + Math.round(30 * (token.length / span));
}

/**
 * Scores a command against a query: every whitespace-separated token must match the label or a
 * keyword (keywords count for less). An empty query matches everything with score 0.
 *
 * @param command - The command to score.
 * @param query - What the visitor typed.
 * @returns The score, or `-1` when the command does not match.
 */
export function scoreCommand(command: PaletteCommand, query: string): number {
  return scorePrepared(prepare(command), tokenize(query));
}

/** A command's label and keywords, normalized once. */
interface PreparedCommand {
  label: string;
  keywords: string[];
}

/** Normalized text per command, so typing never re-normalizes the same labels. */
const preparedCache = new WeakMap<PaletteCommand, PreparedCommand>();

/** Returns (and caches) the normalized label and keywords of a command. */
function prepare(command: PaletteCommand): PreparedCommand {
  let prepared = preparedCache.get(command);
  if (!prepared) {
    prepared = {
      label: normalizeText(command.label),
      keywords: [command.group, ...command.keywords].map(normalizeText),
    };
    preparedCache.set(command, prepared);
  }
  return prepared;
}

/** Splits a query into normalized, non-empty tokens. */
function tokenize(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** {@link scoreCommand} on already normalized text and tokens. */
function scorePrepared({ label, keywords }: PreparedCommand, tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    const best = Math.max(
      scoreToken(label, token),
      ...keywords.map((keyword) => Math.floor(scoreToken(keyword, token) / 2)),
    );
    if (best <= 0) return -1;
    total += best;
  }
  return total;
}

/** A group of filtered commands, as shown in the list. */
export interface CommandSection {
  group: CommandGroup;
  commands: PaletteCommand[];
}

/**
 * Filters commands for a query (substring and fuzzy matching, see {@link scoreCommand}) and
 * groups them. With an empty query everything is listed in its original order. Otherwise each
 * group is sorted best match first and the groups are ordered by their best match (ties keep
 * the {@link COMMAND_GROUPS} order), so Enter on the first option runs the best match.
 *
 * @param commands - Every command.
 * @param query - What the visitor typed.
 * @returns Non-empty sections, in display order.
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): CommandSection[] {
  const tokens = tokenize(query);
  const sections = COMMAND_GROUPS.map((group) => {
    const scored = commands
      .filter((command) => command.group === group)
      .map((command, index) => ({ command, index, score: scorePrepared(prepare(command), tokens) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    return { group, best: scored[0]?.score ?? -1, commands: scored.map((entry) => entry.command) };
  }).filter((section) => section.commands.length > 0);
  return sections
    .map((section, order) => ({ ...section, order }))
    .sort((a, b) => b.best - a.best || a.order - b.order)
    .map(({ group, commands: list }) => ({ group, commands: list }));
}

/** The parts of a keyboard event {@link isPaletteShortcut} looks at. */
export type ShortcutKeyPress = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing" | "defaultPrevented"
>;

/**
 * Whether a key press is the palette shortcut: Ctrl+K (Windows, Linux) or Cmd+K (macOS), with no
 * Shift or Alt (so browser shortcuts such as Ctrl+Shift+K are left alone). Presses another
 * handler already claimed (`defaultPrevented`) and IME composition never count. Where focus is
 * (form fields) is checked by the listener, not here.
 *
 * @param event - The key press.
 */
export function isPaletteShortcut(event: ShortcutKeyPress): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.shiftKey) return false;
  if (event.ctrlKey === event.metaKey) return false; // neither, or both
  return event.key.toLowerCase() === "k";
}

/** What a key press in the palette's input does. */
export type PaletteKeyResult =
  { type: "move"; index: number } | { type: "run"; index: number } | { type: "none" };

/**
 * Keyboard handling for the palette's combobox input: ArrowDown / ArrowUp move the active option
 * (wrapping around) and Enter runs the active option. Every other key, including Home / End,
 * stays with the text field, as in the APG combobox pattern.
 *
 * @param key - `KeyboardEvent.key`.
 * @param activeIndex - The active option (0-based; ignored when `count` is 0).
 * @param count - How many options are listed.
 * @returns What to do; `none` leaves the key to the browser.
 */
export function paletteKeyAction(
  key: string,
  activeIndex: number,
  count: number,
): PaletteKeyResult {
  if (count <= 0) return { type: "none" };
  const current = Math.min(Math.max(activeIndex, 0), count - 1);
  switch (key) {
    case "ArrowDown":
      return { type: "move", index: (current + 1) % count };
    case "ArrowUp":
      return { type: "move", index: (current - 1 + count) % count };
    case "Enter":
      return { type: "run", index: current };
    default:
      return { type: "none" };
  }
}

/** The palette's open/closed state, for `useSyncExternalStore`. */
export interface PaletteStore {
  /** Registers a listener; returns the unsubscribe function. */
  subscribe(onChange: () => void): () => void;
  /** Whether the palette is open. */
  getSnapshot(): boolean;
  /** Server and hydration snapshot: always closed. */
  getServerSnapshot(): boolean;
  /**
   * Opens the palette.
   *
   * @param trigger - The element that opened it, to get focus back on close. Defaults to
   * whatever has focus when the palette opens.
   */
  open(trigger?: HTMLElement | null): void;
  /** Closes the palette. */
  close(): void;
  /** Opens it when closed, closes it when open (the shortcut). */
  toggle(): void;
  /** The element passed to {@link PaletteStore.open}, if any (cleared on close). */
  readonly trigger: HTMLElement | null;
}

/** Creates a palette store. One per tab is used ({@link paletteStore}); tests make their own. */
export function createPaletteStore(): PaletteStore {
  const listeners = new Set<() => void>();
  let isOpen = false;
  let trigger: HTMLElement | null = null;

  /** Sets the state and notifies listeners when it changed. */
  function set(next: boolean) {
    if (next === isOpen) return;
    isOpen = next;
    if (!next) trigger = null;
    for (const listener of listeners) listener();
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => isOpen,
    getServerSnapshot: () => false,
    open(element) {
      if (!isOpen) trigger = element ?? null;
      set(true);
    },
    close: () => set(false),
    toggle: () => set(!isOpen),
    get trigger() {
      return trigger;
    },
  };
}

/** The site-wide palette store, shared by `CommandPalette` and `CommandPaletteButton`. */
export const paletteStore: PaletteStore = createPaletteStore();

/**
 * Whether the visitor is on an Apple platform, where the shortcut is shown as `⌘ K`.
 *
 * @param platform - `navigator.userAgentData?.platform` or `navigator.platform`.
 */
export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}
