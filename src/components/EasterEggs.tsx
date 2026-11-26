"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CARD_PANEL } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { useOverdrive } from "@/lib/hooks/use-overdrive";
import {
  createSequenceMatcher,
  isEditableTarget,
  isModifiedKeyPress,
  registerRapidClick,
} from "@/lib/konami";
import { overdriveStore } from "@/lib/overdrive";
import { closeToast, isEscapeClaimed } from "@/lib/toast-focus";

/** How long an Easter egg toast stays up (ms) while it is neither hovered nor focused. */
export const EGG_TOAST_MS = 6000;

/** `data-easter-egg` value marking the header logo link (counted for the rapid-click egg). */
export const LOGO_EGG_ATTRIBUTE = "logo";

/** Logged once per page load for visitors who open the developer console. */
export const CONSOLE_GREETING =
  "Hello, fellow developer. Thanks for looking under the hood. " +
  "Some old arcade habits still work here, if you know the arrows.";

/** The Easter eggs that show a toast. */
export type EggKind = "overdrive" | "logo";

/** Copy for each toast: HUD label, heading, body and the live-region announcement. */
export const EGG_MESSAGES: Readonly<
  Record<EggKind, { label: string; title: string; body: string; announcement: string }>
> = Object.freeze({
  overdrive: {
    label: "Cheat code accepted",
    title: "Overdrive engaged",
    body: "The rune circuit runs hot for a few seconds.",
    announcement: "Cheat code accepted. Overdrive engaged for a few seconds.",
  },
  logo: {
    label: "Easter egg",
    title: "Logo fully charged",
    body: "Five clicks in a row. It cannot glow any brighter, promise.",
    announcement: "Easter egg found: logo fully charged.",
  },
});

/** Guards the console greeting, so remounts (Strict Mode, Fast Refresh) never log it twice. */
let greeted = false;

/** Logs {@link CONSOLE_GREETING} with `console.info`, once per page load. */
export function greetDevelopers(): void {
  if (greeted) return;
  greeted = true;
  console.info(CONSOLE_GREETING);
}

/** Allows the greeting again. Tests only. */
export function resetGreetingForTests(): void {
  greeted = false;
}

/** The open toast; `id` changes on every trigger so the announcement is re-read. */
interface EggToast {
  kind: EggKind;
  id: number;
}

/**
 * Site-wide Easter eggs (#13), rendered once in the root layout. Harmless and optional: nothing
 * is gated behind them, no key press or click is ever prevented, and focus is never moved.
 *
 * - Secret input: the classic arrow-key cheat code (Up Up Down Down Left Right Left Right B A,
 *   matched by `createSequenceMatcher` in `src/lib/konami.ts`) engages "overdrive" for 4 s:
 *   the backdrop rune circuit and the boost meter burn brighter (`overdriveStore`). Key presses
 *   in inputs, textareas, selects and contenteditable regions, modifier combinations and
 *   auto-repeats never count. The arrows keep scrolling the page as usual.
 * - Logo: five quick clicks on the header logo link (marked `data-easter-egg="logo"`) within
 *   2 s show a small message. Its normal navigation to Home is untouched.
 * - Console: a one-time `console.info` greeting for developers.
 *
 * Both toast eggs announce themselves in an always-present polite `role="status"` live region
 * and show a small toast in the bottom-left corner from `sm` up, and at the top on phones (so it
 * never stacks over the bottom achievement toast), with a Dismiss button. Escape also closes it.
 * It closes on its own after {@link EGG_TOAST_MS}, except while it is hovered or holds focus
 * (tracked separately). Every close goes through `closeToast`, so focus inside the toast returns
 * to where it was. Closing it also ends overdrive. It fades in with a glow only under
 * `motion-safe:` (`animate-egg-toast-in`), with no movement.
 */
export function EasterEggs() {
  const [toast, setToast] = useState<EggToast | null>(null);
  // Hover and focus pause the auto-close independently: a mouse passing over and leaving must
  // never close a toast that holds keyboard focus.
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const paused = hovered || focusWithin;
  const overdrive = useOverdrive();
  const headingId = useId();
  const toastRef = useRef<HTMLElement>(null);
  // The element focused when the toast opened, to restore focus on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  const nextId = useRef(0);

  /** Shows the toast for `kind`, remembering where focus was. */
  const show = useCallback((kind: EggKind) => {
    const active = document.activeElement;
    // Keep the original target when a second egg replaces an open toast.
    if (!toastRef.current?.contains(active)) {
      returnFocus.current = active instanceof HTMLElement ? active : null;
    }
    nextId.current += 1;
    setToast({ kind, id: nextId.current });
  }, []);

  /** Closes the toast and ends overdrive, returning focus if it was inside the toast. */
  const dismiss = useCallback(() => {
    closeToast(toastRef, returnFocus, () => {
      overdriveStore.stop();
      setToast(null);
      setHovered(false);
      setFocusWithin(false);
    });
  }, []);

  // Console greeting, once per page load.
  useEffect(() => greetDevelopers(), []);

  // Secret input listener. Never calls preventDefault, so keyboard navigation is untouched.
  useEffect(() => {
    const matcher = createSequenceMatcher();

    /** Feeds plain key presses outside form fields to the matcher. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (isModifiedKeyPress(event)) return;
      if (isEditableTarget(event.target)) {
        matcher.reset();
        return;
      }
      if (matcher.push(event.key)) {
        overdriveStore.engage();
        show("overdrive");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [show]);

  // Rapid logo clicks. Captured passively; the link still navigates.
  useEffect(() => {
    let times: number[] = [];

    /** Counts clicks on the marked logo link. */
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(`[data-easter-egg="${LOGO_EGG_ATTRIBUTE}"]`)) return;
      const result = registerRapidClick(times, performance.now());
      times = result.times;
      if (result.triggered) show("logo");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show]);

  // Escape closes the toast.
  useEffect(() => {
    if (!toast) return;
    /**
     * Escape closes the toast (it never stops other Escape handlers), unless a modal dialog such
     * as the command palette is open or another handler claimed the press.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isEscapeClaimed(event)) dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toast, dismiss]);

  // Auto-close, restarted by every new trigger and held while hovered or focused.
  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(dismiss, EGG_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused, dismiss]);

  const message = toast ? EGG_MESSAGES[toast.kind] : null;

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only" data-testid="easter-egg-status">
        {toast && message && <span key={toast.id}>{message.announcement}</span>}
      </p>
      {toast && message && (
        <section
          ref={toastRef}
          aria-labelledby={headingId}
          data-testid="easter-egg-toast"
          data-egg={toast.kind}
          data-overdrive={overdrive}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocusWithin(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
          }}
          className={`${CARD_PANEL} fixed inset-x-4 top-4 z-50 px-5 py-4 shadow-glow motion-safe:animate-egg-toast-in sm:inset-x-auto sm:top-auto sm:bottom-6 sm:left-6 sm:w-80`}
        >
          <div className="relative min-w-0">
            <Label as="p" rune>
              {message.label}
            </Label>
            <h2 id={headingId} className="mt-1 font-display text-lg font-semibold">
              {message.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{message.body}</p>
          </div>
          <div className="relative mt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
