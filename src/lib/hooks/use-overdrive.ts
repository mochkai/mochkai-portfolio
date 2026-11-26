"use client";

import { useSyncExternalStore } from "react";
import { overdriveStore } from "@/lib/overdrive";

/**
 * Whether the temporary "overdrive" Easter egg effect is on, live. Off during server rendering
 * and hydration, so the server HTML and the first client render always match. Actions live on
 * `overdriveStore` (`engage`, `stop`).
 *
 * @returns `true` while overdrive is on.
 */
export function useOverdrive(): boolean {
  return useSyncExternalStore(
    overdriveStore.subscribe,
    overdriveStore.getSnapshot,
    overdriveStore.getServerSnapshot,
  );
}
