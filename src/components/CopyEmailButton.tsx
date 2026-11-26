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
 *
 * Falls back gracefully: when the Clipboard API is missing (insecure context, old browser) or
 * the write is refused, it says so and points to the visible address instead of failing
 * silently.
 */
export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear a pending reset when the component unmounts.
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Writes the address to the clipboard and reports the outcome. */
  async function copy() {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(email);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), COPY_STATUS_MS);
    } catch {
      setStatus("failed");
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
