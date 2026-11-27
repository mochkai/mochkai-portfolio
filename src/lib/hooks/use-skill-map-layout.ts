"use client";

import { useSyncExternalStore } from "react";
import { layoutStore } from "@/lib/skill-map-layout";
import type { SkillMapLayoutKind } from "@/lib/skill-tree";

/**
 * The visitor's skill map layout, live (it also follows changes made in another tab).
 *
 * During server rendering and hydration it returns Constellation, so the server HTML and the
 * first client render always match; a stored World tree applies right after hydration. Change
 * it with `layoutStore.set`.
 *
 * @returns The current layout.
 */
export function useSkillMapLayout(): SkillMapLayoutKind {
  return useSyncExternalStore(
    layoutStore.subscribe,
    layoutStore.getSnapshot,
    layoutStore.getServerSnapshot,
  );
}
