"use client";

import { useState } from "react";
import { CollectibleRune } from "@/components/CollectibleRune";
import { progressStore } from "@/lib/collectible-progress";
import { COLLECTIBLE_COUNT, type CollectibleId, getCollectible } from "@/lib/collectibles";
import { cx } from "@/lib/cx";
import { useCollectibleProgress } from "@/lib/hooks/use-collectible-progress";

/** Props for {@link Collectible}. */
export interface CollectibleProps {
  /** Which shard this is (see `COLLECTIBLES` in `src/lib/collectibles.ts`). */
  id: CollectibleId;
  /** Placement classes from the page (margins, alignment). */
  className?: string;
}

/**
 * A hidden rune shard: a real `<button>` (mouse, touch and keyboard) with a 44 px target around
 * a small, dim rune that only lights up on hover or focus, so it stays discreet next to the
 * content. Its accessible name says which shard it is ("Collect rune shard 2 of 5").
 *
 * Collecting it saves progress (`progressStore`), plays a short glow (no movement, only under
 * `motion-safe:`) and leaves the shard filled and glowing. The button stays in place and
 * focusable, marked `aria-disabled`, so focus is never lost; collecting it again does nothing.
 * The announcement happens in the site-wide live region of {@link CollectibleToast}.
 *
 * Until hydration it renders as not collected (the server cannot know), then shows the stored
 * state. It renders no `id` attributes, so pages kept mounted by Next never duplicate ids.
 */
export function Collectible({ id, className }: CollectibleProps) {
  const { found } = useCollectibleProgress();
  // True from the click until the glow animation ends (it never starts under reduced motion).
  const [glowing, setGlowing] = useState(false);
  const collected = found.includes(id);
  const { number } = getCollectible(id);

  /** Collects the shard once; later presses are ignored. */
  function collect() {
    if (collected) return;
    setGlowing(true);
    progressStore.collect(id);
  }

  return (
    <button
      type="button"
      onClick={collect}
      aria-disabled={collected || undefined}
      aria-label={
        collected
          ? `Rune shard ${number} of ${COLLECTIBLE_COUNT}, collected`
          : `Collect rune shard ${number} of ${COLLECTIBLE_COUNT}`
      }
      data-testid={`collectible-${id}`}
      data-collected={collected ? "true" : "false"}
      onAnimationEnd={() => setGlowing(false)}
      className={cx(
        "group inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "motion-safe:transition-[color,filter] motion-safe:duration-150 motion-safe:ease-out",
        collected
          ? "cursor-default text-glow drop-shadow-glow"
          : "cursor-pointer text-brand hover:text-neon hover:drop-shadow-glow focus-visible:text-neon focus-visible:drop-shadow-glow",
        glowing && "motion-safe:animate-shard-collect",
        className,
      )}
    >
      <CollectibleRune filled={collected} className="size-5" />
    </button>
  );
}
