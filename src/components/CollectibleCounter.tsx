"use client";

import { CollectibleRune } from "@/components/CollectibleRune";
import { COLLECTIBLE_COUNT, nextCollectible } from "@/lib/collectibles";
import { useCollectibleProgress } from "@/lib/hooks/use-collectible-progress";

/**
 * The HUD rune counter in the site header (`RUNES 2/5`). Hidden until the first shard is found,
 * so visitors who never find one never see it; it also renders nothing on the server and during
 * hydration (the progress store's server snapshot is empty), so there is no mismatch.
 *
 * Not interactive. Screen readers get "Rune shards found: 2 of 5"; the tooltip names where the
 * next missing shard is.
 */
export function CollectibleCounter() {
  const { found } = useCollectibleProgress();
  if (found.length === 0) return null;
  const next = nextCollectible(found);

  return (
    <p
      data-testid="collectible-counter"
      title={next ? `Next rune shard: ${next.hint}` : "Every rune shard found"}
      className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs tracking-[0.2em] whitespace-nowrap text-glow uppercase"
    >
      <CollectibleRune filled className="size-3.5 text-neon" />
      <span aria-hidden="true">
        Runes{" "}
        <span className="tabular-nums">
          {found.length}/{COLLECTIBLE_COUNT}
        </span>
      </span>
      <span className="sr-only">
        Rune shards found: {found.length} of {COLLECTIBLE_COUNT}
      </span>
    </p>
  );
}
