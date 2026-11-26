import {
  COLLECTIBLES,
  COLLECTIBLE_COUNT,
  type CollectibleId,
  getCollectible,
  isCollectibleId,
  nextCollectible,
} from "./collectibles";

/** `localStorage` key holding the found shard ids as a JSON array. Versioned for migrations. */
export const PROGRESS_STORAGE_KEY = "mochkai:collectibles:v1";

/** What the progress store exposes to React. Immutable: every change makes a new object. */
export interface CollectibleProgress {
  /** Ids found so far, in display order, without duplicates. */
  readonly found: readonly CollectibleId[];
  /**
   * Text for the polite live region after the latest collect or reset in this tab (empty until
   * then). Changes made in another tab update `found` silently.
   */
  readonly announcement: string;
  /** True right after this tab collected the last shard, until the toast is dismissed. */
  readonly achievement: boolean;
}

/** A small external store for {@link useSyncExternalStore}, plus its actions. */
export interface ProgressStore {
  /** Registers a listener for changes (also cross-tab `storage` events); returns unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Current progress. Returns the same object until something changes. */
  getSnapshot(): CollectibleProgress;
  /** Progress during server rendering and hydration: always "nothing collected". */
  getServerSnapshot(): CollectibleProgress;
  /** Marks a shard as found, saves it and announces it. Collecting a found shard is a no-op. */
  collect(id: CollectibleId): void;
  /** Hides the achievement toast. */
  dismissAchievement(): void;
  /** Forgets every found shard (storage too) and announces the reset. */
  reset(): void;
}

/** The server and hydration snapshot. Shared, so it is referentially stable. */
const NOTHING_COLLECTED: CollectibleProgress = Object.freeze({
  found: Object.freeze([]) as readonly CollectibleId[],
  announcement: "",
  achievement: false,
});

/** Announced after a reset from the achievement toast. */
export const RESET_ANNOUNCEMENT = "Rune shards reset. They are back in their hiding places.";

/**
 * Parses stored progress. Anything malformed (bad JSON, not an array, unknown ids) is dropped
 * rather than trusted, so a stale or tampered value can never break the page.
 *
 * @param raw - The stored string, or `null` when nothing is stored.
 * @returns Known ids in display order, without duplicates.
 */
export function parseProgress(raw: string | null): CollectibleId[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(value) ? inDisplayOrder(value) : [];
}

/**
 * Keeps the known collectible ids from `values`, in display order and without duplicates.
 *
 * @param values - Candidate ids (anything else is ignored).
 */
function inDisplayOrder(values: Iterable<unknown>): CollectibleId[] {
  const ids = new Set([...values].filter(isCollectibleId));
  return COLLECTIBLES.map((item) => item.id).filter((id) => ids.has(id));
}

/**
 * The live-region text after collecting a shard.
 *
 * @param id - The shard just collected.
 * @param found - Every found id, including `id`.
 */
export function collectAnnouncement(id: CollectibleId, found: readonly CollectibleId[]): string {
  const { number } = getCollectible(id);
  const progress = `Rune shard ${number} found. ${found.length} of ${COLLECTIBLE_COUNT} collected.`;
  if (found.length >= COLLECTIBLE_COUNT) {
    return `${progress} Achievement unlocked: every rune shard found.`;
  }
  const next = nextCollectible(found);
  return next ? `${progress} Next: ${next.hint}` : progress;
}

/**
 * Creates a progress store backed by `getStorage()` (normally `window.localStorage`).
 *
 * Storage is optional: when `getStorage` returns `null` or any storage call throws (private
 * mode, disabled cookies, quota), progress lives in memory for this tab and nothing errors.
 * Stored progress is read lazily on the first client snapshot, so importing this module on the
 * server is safe. Other tabs' changes arrive through the `storage` event.
 *
 * @param getStorage - Returns the storage to use, or `null` where there is none. May throw.
 */
export function createProgressStore(getStorage: () => Storage | null): ProgressStore {
  const listeners = new Set<() => void>();
  let state: CollectibleProgress = NOTHING_COLLECTED;
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

  /** Reads stored ids; `[]` when there is nothing or storage is unavailable. */
  function readStored(): CollectibleId[] {
    return parseProgress(withStorage((storage) => storage.getItem(PROGRESS_STORAGE_KEY)) ?? null);
  }

  /** Loads stored progress once, on the first client read. */
  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const found = readStored();
    if (found.length > 0) state = { ...NOTHING_COLLECTED, found };
  }

  /** Replaces the state and notifies every listener. */
  function setState(next: CollectibleProgress) {
    state = next;
    for (const listener of listeners) listener();
  }

  /** Applies another tab's change to our key. */
  function onStorage(event: StorageEvent) {
    // `key` is null when the other tab called `localStorage.clear()`.
    if (event.key !== null && event.key !== PROGRESS_STORAGE_KEY) return;
    ensureLoaded();
    const found = parseProgress(event.key === null ? null : event.newValue);
    if (found.join() === state.found.join()) return;
    setState({ ...state, found, achievement: state.achievement && found.length > 0 });
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
      return state;
    },

    getServerSnapshot() {
      return NOTHING_COLLECTED;
    },

    collect(id) {
      ensureLoaded();
      // Re-read first so a shard found in another tab in the meantime is never overwritten.
      const known = inDisplayOrder([...state.found, ...readStored()]);
      if (known.includes(id)) {
        if (known.length !== state.found.length) setState({ ...state, found: known });
        return;
      }
      const found = inDisplayOrder([...known, id]);
      withStorage((storage) => storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(found)));
      setState({
        found,
        announcement: collectAnnouncement(id, found),
        achievement: found.length >= COLLECTIBLE_COUNT,
      });
    },

    dismissAchievement() {
      if (state.achievement) setState({ ...state, achievement: false });
    },

    reset() {
      loaded = true;
      withStorage((storage) => storage.removeItem(PROGRESS_STORAGE_KEY));
      setState({
        found: NOTHING_COLLECTED.found,
        announcement: RESET_ANNOUNCEMENT,
        achievement: false,
      });
    },
  };
}

/** `window.localStorage`, or `null` on the server. Accessing it may throw (blocked storage). */
function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** The site-wide progress store (one per browser tab). */
export const progressStore: ProgressStore = createProgressStore(browserStorage);
