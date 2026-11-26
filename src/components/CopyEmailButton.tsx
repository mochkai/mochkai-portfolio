"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/** Props for {@link CopyEmailButton}. */
export interface CopyEmailButtonProps {
  /** The address written to the clipboard. */
  email: string;
}

/** What the last copy attempt did: nothing yet, copied, or failed. */
type CopyStatus = "idle" | "copied" | "failed";

/** How long the "Copied" confirmation stays visible, in milliseconds. */
export const COPY_STATUS_MS = 2500;

/**
 * Gap between clearing the live region and writing "Copied" again on a repeat copy, in
 * milliseconds. Screen readers only announce a change, so identical text must be removed and
 * re-added in separate updates.
 */
export const REANNOUNCE_GAP_MS = 150;

/** The visible (and announced) text for each status. */
const STATUS_TEXT: Record<CopyStatus, string> = {
  idle: "",
  copied: "Copied",
  failed: "Copy is not available here. Select the address to copy it.",
};

/**
 * Copies the owner's email address with the Clipboard API. The result is shown next to the
 * button and announced through a polite `role="status"` live region that is always in the DOM
 * (so screen readers pick up the change). "Copied" clears itself after {@link COPY_STATUS_MS}.
 * Copying again while "Copied" is still shown clears the region first and re-adds the text
 * {@link REANNOUNCE_GAP_MS} later, so every copy is announced, not only the first.
 *
 * Falls back gracefully: when the Clipboard API is missing (insecure context, old browser) or
 * the write is refused, it says so and points to the visible address instead of failing
 * silently.
 */
export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Whether the live region currently has text. A ref, not `status`, so overlapping clicks
  // (a second click while the first write is still pending) see the latest value.
  const shown = useRef(false);

  // Clear a pending reset when the component unmounts.
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Sets the live region's status and keeps {@link shown} in step. */
  function setRegion(next: CopyStatus) {
    shown.current = next !== "idle";
    setStatus(next);
  }

  /** Shows `next`; "Copied" also schedules its own reset. */
  function show(next: CopyStatus) {
    clearTimeout(timer.current);
    setRegion(next);
    if (next === "copied") timer.current = setTimeout(() => setRegion("idle"), COPY_STATUS_MS);
  }

  /**
   * Reports an outcome. When the region was just cleared by this click, or another click's
   * outcome is showing, it empties the region and re-adds the text after
   * {@link REANNOUNCE_GAP_MS}, so the change is announced.
   */
  function report(next: CopyStatus, cleared: boolean) {
    clearTimeout(timer.current);
    if (cleared || shown.current) {
      setRegion("idle");
      timer.current = setTimeout(() => show(next), REANNOUNCE_GAP_MS);
    } else {
      show(next);
    }
  }

  /** Writes the address to the clipboard and reports the outcome. */
  async function copy() {
    clearTimeout(timer.current);
    // A repeat while the region still has text: empty it now so the re-add is a change.
    const cleared = shown.current;
    if (cleared) setRegion("idle");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(email);
      report("copied", cleared);
    } catch {
      report("failed", cleared);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="ghost" onClick={copy} className="text-sm">
        Copy email
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={status === "failed" ? "text-sm text-muted" : "font-mono text-xs text-glow"}
      >
        {STATUS_TEXT[status]}
      </p>
    </div>
  );
}
