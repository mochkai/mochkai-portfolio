"use client";

import { type RefObject, useEffect, useId, useRef } from "react";
import { CollectibleRune } from "@/components/CollectibleRune";
import { Button } from "@/components/ui/Button";
import { CARD_PANEL } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { progressStore } from "@/lib/collectible-progress";
import { COLLECTIBLE_COUNT } from "@/lib/collectibles";
import { useCollectibleProgress } from "@/lib/hooks/use-collectible-progress";

/**
 * Runs `action` (which hides the toast), then, if focus was inside the toast, moves it back to
 * `returnFocus` so it is not dropped to the document body.
 *
 * @param toast - The toast element.
 * @param returnFocus - Where focus was when the toast opened.
 * @param action - Hides the toast (dismiss or reset).
 */
function closeToast(
  toast: RefObject<HTMLElement | null>,
  returnFocus: RefObject<HTMLElement | null>,
  action: () => void,
) {
  const hadFocus = toast.current?.contains(document.activeElement) ?? false;
  action();
  const target = returnFocus.current;
  if (hadFocus && target?.isConnected) target.focus();
}

/**
 * Site-wide collectible feedback, rendered once in the root layout (outside the header, whose
 * backdrop filter would trap a fixed child). The toast uses `CARD_PANEL`, not `CARD_SURFACE`,
 * so its `fixed` never competes with `relative`:
 *
 * - A polite `role="status"` live region, always in the DOM and visually hidden, that announces
 *   every collect ("Rune shard 2 found. 2 of 5 collected. Next: ...") and resets.
 * - After the last shard is collected in this tab, a small "Achievement unlocked" toast in the
 *   bottom corner with "Dismiss" and "Reset shards". It never moves focus or times out; Escape
 *   closes it too. When it closes while focus is inside it, focus returns to where it was when
 *   it opened (normally the shard just collected). It fades in with a glow, only under
 *   `motion-safe:` (no movement).
 */
export function CollectibleToast() {
  const { announcement, achievement } = useCollectibleProgress();
  const headingId = useId();
  const toastRef = useRef<HTMLElement>(null);
  // The element focused when the toast opened, to restore focus on close.
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!achievement) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement ? active : null;

    /** Escape closes the toast. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeToast(toastRef, returnFocus, () => progressStore.dismissAchievement());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [achievement]);

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only" data-testid="collectible-status">
        {announcement}
      </p>
      {achievement && (
        <section
          ref={toastRef}
          aria-labelledby={headingId}
          data-testid="achievement-toast"
          className={`${CARD_PANEL} fixed inset-x-4 bottom-4 z-50 px-5 py-4 shadow-glow motion-safe:animate-achievement-in sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80`}
        >
          <div className="relative flex items-start gap-3">
            <CollectibleRune filled className="mt-1 size-6 text-glow drop-shadow-glow" />
            <div className="min-w-0">
              <Label as="p">Achievement unlocked</Label>
              <h2 id={headingId} className="mt-1 font-display text-lg font-semibold">
                All {COLLECTIBLE_COUNT} rune shards found
              </h2>
              <p className="mt-1 text-sm text-muted">Thanks for exploring every corner.</p>
            </div>
          </div>
          <div className="relative mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => closeToast(toastRef, returnFocus, () => progressStore.reset())}
            >
              Reset shards
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                closeToast(toastRef, returnFocus, () => progressStore.dismissAchievement())
              }
            >
              Dismiss
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
