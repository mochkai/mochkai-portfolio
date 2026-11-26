"use client";

import { useSyncExternalStore } from "react";
import { SearchIcon } from "@/components/SearchIcon";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { isApplePlatform, paletteStore } from "@/lib/command-palette";

/** The platform never changes while the page is open, so there is nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => {};
}

/** Reads the platform on the client (`userAgentData` where available). */
function getIsApple(): boolean {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return isApplePlatform(data?.platform || navigator.platform || "");
}

/** Server and hydration snapshot: show `Ctrl K` until the client knows the platform. */
function getServerIsApple(): boolean {
  return false;
}

/** Props for {@link CommandPaletteButton}. */
export interface CommandPaletteButtonProps {
  /** Layout classes from the header (order, margins). Never colors or padding. */
  className?: string;
}

/**
 * The header's "Fast travel" HUD button: opens the {@link CommandPalette} for touch and mouse
 * users (keyboard users can also press Ctrl+K / Cmd+K). A 44 px outlined chip with a magnifier;
 * from 1024 px it also shows the shortcut as a key chip, `Ctrl K`, or `⌘ K` on Apple platforms
 * (read after hydration, so the server HTML and the first client render match).
 *
 * Its accessible name is "Fast travel" (the dialog's title), with `aria-haspopup="dialog"` and
 * `aria-keyshortcuts`. It passes itself to `paletteStore.open`, so focus comes back here on close.
 */
export function CommandPaletteButton({ className }: CommandPaletteButtonProps) {
  const apple = useSyncExternalStore(subscribeNever, getIsApple, getServerIsApple);

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      title={`Fast travel (${apple ? "⌘K" : "Ctrl+K"})`}
      data-testid="command-palette-button"
      onClick={(event) => paletteStore.open(event.currentTarget)}
      className={buttonClasses("secondary", className, "sm")}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="sr-only">Fast travel</span>
      <kbd
        aria-hidden="true"
        className="font-mono text-xs font-normal tracking-wide whitespace-nowrap max-lg:hidden"
      >
        {apple ? "⌘ K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
