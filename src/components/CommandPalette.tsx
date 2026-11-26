"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { CARD_PANEL } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { SearchIcon } from "@/components/SearchIcon";
import {
  filterCommands,
  isPaletteShortcut,
  paletteKeyAction,
  paletteStore,
  type PaletteCommand,
} from "@/lib/command-palette";
import { cx } from "@/lib/cx";
import { isEditableTarget } from "@/lib/konami";

/** Props for {@link CommandPalette}. */
export interface CommandPaletteProps {
  /** Every command, built on the server with `buildCommands` from repository content. */
  commands: readonly PaletteCommand[];
}

/** What the last "Copy email address" did. */
type CopyStatus = { kind: "copied" } | { kind: "failed"; text: string } | null;

/** Hint shown under each option's label, by action. */
const ACTION_HINT: Record<PaletteCommand["action"]["type"], string> = {
  navigate: "Go",
  external: "New tab",
  copy: "Copy",
};

/** A keyboard key chip in the hint row. */
const KEY = "rounded-sm border border-line px-1 py-px font-mono text-glow";

/** Whether another modal `<dialog>` (not the palette) is showing; the shortcut then does nothing. */
function otherModalOpen(palette: HTMLDialogElement | null): boolean {
  return Array.from(document.querySelectorAll("dialog")).some((dialog) => {
    if (dialog === palette || !dialog.open) return false;
    try {
      return dialog.matches(":modal");
    } catch {
      // Engines without `:modal` (jsdom): count any other open dialog.
      return true;
    }
  });
}

/**
 * Whether focus can go back to `element`: still in the document and rendered. Next keeps the
 * previous page mounted but hidden after a navigation, so an opener on that page is skipped.
 */
function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element === document.body) return false;
  return typeof element.checkVisibility === "function" ? element.checkVisibility() : true;
}

/**
 * The site-wide "Fast travel" command palette (#14), rendered once in the root layout.
 *
 * Opens with Ctrl+K / Cmd+K (never while focus is in another input, textarea, select or
 * contenteditable region, checked with `isEditableTarget`; Ctrl+K in the palette's own input
 * closes it; `preventDefault` is called only when the shortcut acts, and not while another modal
 * dialog is showing) or with the
 * header's {@link CommandPaletteButton}, through the shared `paletteStore`. It is a native
 * `<dialog>` opened with `showModal()`, so the rest of the page is inert (focus stays inside),
 * and labelled by its HUD label. Escape, the Close button, a click on the backdrop or the
 * shortcut again close it, and focus returns to the element that opened it.
 *
 * Inside, the APG combobox pattern: a text input (`role="combobox"`) owns a `role="listbox"`
 * of grouped options and points at the active one with `aria-activedescendant`, so focus never
 * leaves the input. Typing filters (substring and fuzzy, `filterCommands`); ArrowUp / ArrowDown
 * move (wrapping), Enter or a click runs: pages and projects navigate with the router, social
 * links open in a new tab, and "Copy email address" copies and shows the result in the palette.
 * The result count is announced politely. Opening fades the panel in with a glow under
 * `motion-safe:` only (`animate-palette-in`, no movement); closing is instant.
 */
export function CommandPalette({ commands }: CommandPaletteProps) {
  const open = useSyncExternalStore(
    paletteStore.subscribe,
    paletteStore.getSnapshot,
    paletteStore.getServerSnapshot,
  );
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The element focused (or the trigger passed) when the palette opened.
  const returnFocus = useRef<HTMLElement | null>(null);
  // Whether the current pointer press started on the backdrop.
  const pressedBackdrop = useRef(false);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (command: PaletteCommand) => `${baseId}-option-${command.id}`;

  const sections = useMemo(() => filterCommands(commands, query), [commands, query]);
  const results = useMemo(() => sections.flatMap((section) => section.commands), [sections]);
  // Index of each section's first option in `results`, so options know their flat index.
  const sectionStarts = useMemo(
    () =>
      sections.reduce<number[]>(
        (starts, section, i) => [
          ...starts,
          i === 0 ? 0 : starts[i - 1] + sections[i - 1].commands.length,
        ],
        [],
      ),
    [sections],
  );
  const active = results.length > 0 ? Math.min(activeIndex, results.length - 1) : -1;
  const activeCommand = active >= 0 ? results[active] : undefined;

  // Shortcut listener. preventDefault only for Ctrl+K / Cmd+K, and only when it opens or closes
  // the palette; it never stops propagation, so other listeners (the Easter eggs) still run.
  useEffect(() => {
    /** Toggles the palette on Ctrl+K / Cmd+K. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      // Other form fields keep Ctrl+K; the palette's own input is the exception (it closes).
      const inPalette = event.target === inputRef.current;
      if (!inPalette && isEditableTarget(event.target)) return;
      if (otherModalOpen(dialogRef.current)) return;
      event.preventDefault();
      paletteStore.toggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keep the native dialog in step with the store.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const focused = document.activeElement;
      returnFocus.current =
        paletteStore.trigger ?? (focused instanceof HTMLElement ? focused : null);
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Keep the active option in view while moving through a long list.
  useEffect(() => {
    if (!open || !activeCommand) return;
    document
      .getElementById(`${baseId}-option-${activeCommand.id}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeCommand, baseId]);

  /** Closes the dialog (its `close` event then resets the palette). */
  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else paletteStore.close();
  }, []);

  /** Runs after every close (Escape, button, backdrop, command, shortcut): reset and refocus. */
  function handleClose() {
    paletteStore.close();
    setQuery("");
    setActiveIndex(0);
    setCopyStatus(null);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (canRestoreFocus(target)) target.focus();
  }

  /** Runs a command. */
  async function run(command: PaletteCommand) {
    const { action } = command;
    if (action.type === "copy") {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
        await navigator.clipboard.writeText(action.text);
        setCopyStatus({ kind: "copied" });
      } catch {
        setCopyStatus({ kind: "failed", text: action.text });
      }
      return;
    }
    close();
    if (action.type === "external") {
      window.open(action.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(action.href);
    }
  }

  /** Arrow keys move the active option, Enter runs it (see `paletteKeyAction`). */
  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    const result = paletteKeyAction(event.key, active, results.length);
    if (result.type === "none") return;
    event.preventDefault();
    if (result.type === "move") setActiveIndex(result.index);
    else void run(results[result.index]);
  }

  /** Records where a press started, so a drag that ends on the backdrop is not a backdrop click. */
  function handleDialogPointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    pressedBackdrop.current = event.target === event.currentTarget;
  }

  /**
   * A click on the backdrop (the dialog box itself, outside the panel content) closes it, but
   * only when the press also started there: dragging a text selection out of the input does not.
   */
  function handleDialogClick(event: ReactMouseEvent<HTMLDialogElement>) {
    const startedOnBackdrop = pressedBackdrop.current;
    pressedBackdrop.current = false;
    if (startedOnBackdrop && event.target === event.currentTarget) close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-testid="command-palette"
      onClose={handleClose}
      onPointerDown={handleDialogPointerDown}
      onClick={handleDialogClick}
      className={cx(
        CARD_PANEL,
        "fixed inset-x-0 top-[8vh] bottom-auto mx-auto my-0 w-[calc(100%-2rem)] max-w-xl overflow-hidden p-0 text-foreground shadow-glow-lg backdrop:bg-background/80 backdrop:backdrop-blur-sm motion-safe:open:animate-palette-in sm:top-[14vh]",
      )}
    >
      <div className="relative flex max-h-[min(34rem,80vh)] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <Label as="h2" id={titleId} rune>
            Fast travel
          </Label>
          <Button variant="ghost" size="sm" onClick={close} className="-mr-2">
            Close
          </Button>
        </div>

        <div className="mx-5 mt-1 flex items-center gap-3 border-b border-line pb-3">
          <SearchIcon className="size-5 shrink-0 text-neon" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search pages, projects and contact options"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeCommand ? optionId(activeCommand) : undefined}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Where to?"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setCopyStatus(null);
            }}
            onKeyDown={handleInputKeyDown}
            className="min-h-11 w-full min-w-0 bg-transparent font-display text-lg text-foreground placeholder:text-muted focus:outline-none"
          />
        </div>

        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label="Destinations"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        >
          {sections.map((section, sectionIndex) => {
            const headingId = `${baseId}-group-${section.group.toLowerCase()}`;
            return (
              <div key={section.group} role="group" aria-labelledby={headingId} className="py-1">
                <p
                  id={headingId}
                  role="presentation"
                  className="px-3 pt-2 pb-1 font-mono text-xs tracking-[0.2em] text-muted uppercase"
                >
                  {section.group}
                </p>
                {section.commands.map((command, commandIndex) => {
                  const index = sectionStarts[sectionIndex] + commandIndex;
                  const selected = index === active;
                  return (
                    <div
                      key={command.id}
                      id={optionId(command)}
                      role="option"
                      aria-selected={selected}
                      data-testid="command-option"
                      onClick={() => void run(command)}
                      onMouseMove={() => {
                        if (!selected) setActiveIndex(index);
                      }}
                      className={cx(
                        "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                        selected ? "bg-accent-soft text-foreground" : "text-muted",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "size-2 shrink-0 rotate-45 border",
                          selected ? "border-neon bg-neon shadow-glow-sm" : "border-muted",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-display font-medium">
                        {command.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cx(
                          "shrink-0 font-mono text-xs",
                          selected ? "text-glow" : "text-muted",
                        )}
                      >
                        {ACTION_HINT[command.action.type]}
                        {command.action.type === "external" && " ↗"}
                      </span>
                      {command.action.type === "external" && (
                        <span className="sr-only"> (opens in a new tab)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {results.length === 0 && (
          <p className="px-8 pb-4 text-sm text-muted">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a page or project name.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-muted">
          <p role="status" aria-live="polite" className="min-h-4" data-testid="command-status">
            {copyStatus?.kind === "copied" && (
              <span className="text-glow">Email address copied</span>
            )}
            {copyStatus?.kind === "failed" && (
              <>
                Copy is not available here. The address is{" "}
                <span className="font-mono break-all text-foreground select-all">
                  {copyStatus.text}
                </span>
              </>
            )}
          </p>
          <p aria-hidden="true" className="flex items-center gap-3 font-mono max-sm:hidden">
            <span>
              <kbd className={KEY}>↑</kbd> <kbd className={KEY}>↓</kbd> move
            </span>
            <span>
              <kbd className={KEY}>Enter</kbd> open
            </span>
            <span>
              <kbd className={KEY}>Esc</kbd> close
            </span>
          </p>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {open && (results.length === 1 ? "1 result" : `${results.length} results`)}
        </p>
      </div>
    </dialog>
  );
}
