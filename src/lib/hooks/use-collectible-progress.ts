"use client";

import { useSyncExternalStore } from "react";
import { type CollectibleProgress, progressStore } from "@/lib/collectible-progress";

/**
 * The visitor's rune shard progress, live: it updates when a shard is collected in this tab or
 * another one.
 *
 * During server rendering and hydration it returns "nothing collected", so the server HTML
 * and the first client render always match (no hydration warning); the stored progress shows
 * right after hydration. Actions live on `progressStore` (`collect`, `reset`,
 * `dismissAchievement`).
 *
 * @returns The current {@link CollectibleProgress}.
 */
export function useCollectibleProgress(): CollectibleProgress {
  return useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
    progressStore.getServerSnapshot,
  );
}
