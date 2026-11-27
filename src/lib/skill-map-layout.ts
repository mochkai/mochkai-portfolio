import { SKILL_MAP_LAYOUTS, type SkillMapLayoutKind } from "@/lib/skill-tree";

/*
 * The visitor's skill map layout choice (Constellation or World tree), remembered in
 * `localStorage`. The server and hydration snapshot is always Constellation, so the server HTML
 * and the first client render match; a stored World tree applies right after hydration.
 */

/** `localStorage` key holding the chosen layout. Versioned for migrations. */
export const LAYOUT_STORAGE_KEY = "mochkai:skill-map-layout:v1";

/** The layout the server renders and new visitors see. */
export const DEFAULT_LAYOUT: SkillMapLayoutKind = "constellation";

/** A small external store for `useSyncExternalStore`, plus its one action. */
export interface LayoutStore {
  /** Registers a listener (also for other tabs' changes); returns the unsubscribe function. */
  subscribe(onChange: () => void): () => void;
  /** The current layout in this browser. */
  getSnapshot(): SkillMapLayoutKind;
  /** The layout during server rendering and hydration: always {@link DEFAULT_LAYOUT}. */
  getServerSnapshot(): SkillMapLayoutKind;
  /** Switches the layout and remembers it. */
  set(layout: SkillMapLayoutKind): void;
}

/**
 * Parses a stored layout. Anything else (missing, malformed, an old value) is the default.
 *
 * @param raw - The stored string, or `null`.
 * @returns A valid layout.
 */
export function parseLayout(raw: string | null): SkillMapLayoutKind {
  return SKILL_MAP_LAYOUTS.find((layout) => layout === raw) ?? DEFAULT_LAYOUT;
}

/**
 * Creates a layout store backed by `getStorage()` (normally `window.localStorage`). Storage is
 * optional: when it is missing or any call throws (private mode, blocked storage, quota), the
 * choice lives in memory for this tab and nothing errors. Storage is read lazily on the first
 * client snapshot, so importing this module on the server is safe.
 *
 * @param getStorage - Returns the storage to use, or `null` where there is none. May throw.
 * @returns The store.
 */
export function createLayoutStore(getStorage: () => Storage | null): LayoutStore {
  const listeners = new Set<() => void>();
  let layout: SkillMapLayoutKind = DEFAULT_LAYOUT;
  let loaded = false;

  /** Runs `action` against storage, swallowing any error (storage is a nice-to-have). */
  function withStorage<T>(action: (storage: Storage) => T): T | undefined {
    try {
      const storage = getStorage();
      return storage ? action(storage) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Replaces the layout and notifies listeners when it changed. */
  function update(next: SkillMapLayoutKind) {
    if (next === layout) return;
    layout = next;
    for (const listener of listeners) listener();
  }

  /** Loads the stored layout once, on the first client read. */
  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    layout = parseLayout(withStorage((storage) => storage.getItem(LAYOUT_STORAGE_KEY)) ?? null);
  }

  /** Applies another tab's change to our key (`key` is null after `localStorage.clear()`). */
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== LAYOUT_STORAGE_KEY) return;
    loaded = true;
    update(parseLayout(event.key === null ? null : event.newValue));
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
    getSnapshot() {
      ensureLoaded();
      return layout;
    },
    getServerSnapshot() {
      return DEFAULT_LAYOUT;
    },
    set(next) {
      loaded = true;
      withStorage((storage) => storage.setItem(LAYOUT_STORAGE_KEY, next));
      update(next);
    },
  };
}

/** `window.localStorage`, or `null` on the server. Accessing it may throw (blocked storage). */
function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** The site-wide layout store (one per browser tab). */
export const layoutStore: LayoutStore = createLayoutStore(browserStorage);
