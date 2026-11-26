/** How long the overdrive effect lasts after the secret input, in ms. */
export const OVERDRIVE_MS = 4000;

/** A tiny external store for the temporary "overdrive" effect, for `useSyncExternalStore`. */
export interface OverdriveStore {
  /** Registers a listener; returns the unsubscribe function. */
  subscribe(onChange: () => void): () => void;
  /** Whether overdrive is on right now. */
  getSnapshot(): boolean;
  /** Server and hydration snapshot: always off. */
  getServerSnapshot(): boolean;
  /** Turns overdrive on for {@link OVERDRIVE_MS} (restarts the timer when it is already on). */
  engage(): void;
  /** Turns overdrive off now (the visitor dismissed it). */
  stop(): void;
}

/** Timer functions, injectable for tests. */
export interface OverdriveTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The global timers; resolved at call time so fake timers in tests apply. */
const globalTimers: OverdriveTimers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Creates an overdrive store. Overdrive always ends on its own after `durationMs`.
 *
 * @param durationMs - How long one overdrive lasts; defaults to {@link OVERDRIVE_MS}.
 * @param timers - Timer functions; defaults to the global ones.
 */
export function createOverdriveStore(
  durationMs: number = OVERDRIVE_MS,
  timers: OverdriveTimers = globalTimers,
): OverdriveStore {
  const listeners = new Set<() => void>();
  let active = false;
  let timer: unknown = null;

  /** Sets the state and notifies listeners when it changed. */
  function setActive(next: boolean) {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    if (next) timer = timers.setTimeout(() => setActive(false), durationMs);
    if (next === active) return;
    active = next;
    for (const listener of listeners) listener();
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => active,
    getServerSnapshot: () => false,
    engage: () => setActive(true),
    stop: () => setActive(false),
  };
}

/** The site-wide overdrive store (one per tab). */
export const overdriveStore: OverdriveStore = createOverdriveStore();
