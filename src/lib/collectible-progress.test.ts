import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  RESET_ANNOUNCEMENT,
  collectAnnouncement,
  createProgressStore,
  parseProgress,
} from "./collectible-progress";
import { COLLECTIBLES } from "./collectibles";

/** A minimal in-memory `Storage`, so each test starts from a known state. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

/** A `Storage` whose every method throws, like blocked storage or a full quota. */
function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException("denied", "SecurityError");
  };
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

/** Dispatches the `storage` event another tab's write would fire. */
function otherTabWrites(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

const ALL_IDS = COLLECTIBLES.map((item) => item.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseProgress", () => {
  it("keeps known ids in display order without duplicates", () => {
    expect(
      parseProgress(JSON.stringify(["quest-log-end", "title-screen", "title-screen"])),
    ).toEqual(["title-screen", "quest-log-end"]);
  });

  it("drops malformed values instead of throwing", () => {
    expect(parseProgress(null)).toEqual([]);
    expect(parseProgress("")).toEqual([]);
    expect(parseProgress("{not json")).toEqual([]);
    expect(parseProgress(JSON.stringify({ found: ["quest-board"] }))).toEqual([]);
    expect(parseProgress(JSON.stringify(["unknown", 4, null, "quest-board"]))).toEqual([
      "quest-board",
    ]);
  });
});

describe("collectAnnouncement", () => {
  it("names the shard, the count and the next hint", () => {
    expect(collectAnnouncement("quest-board", ["quest-board"])).toBe(
      `Rune shard 2 found. 1 of 5 collected. Next: ${COLLECTIBLES[0].hint}`,
    );
  });

  it("announces the achievement for the last shard", () => {
    expect(collectAnnouncement("character-sheet", ALL_IDS)).toMatch(
      /5 of 5 collected\. Achievement unlocked/,
    );
  });
});

describe("createProgressStore", () => {
  it("starts empty on the server snapshot, even with stored progress", () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: JSON.stringify(["quest-board"]) });
    const store = createProgressStore(() => storage);
    expect(store.getServerSnapshot()).toEqual({ found: [], announcement: "", achievement: false });
    expect(store.getSnapshot().found).toEqual(["quest-board"]);
  });

  it("saves collected shards so a new store (a reload) restores them", () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    store.collect("quest-log-end");
    store.collect("title-screen");
    expect(store.getSnapshot().found).toEqual(["title-screen", "quest-log-end"]);
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY) ?? "")).toEqual([
      "title-screen",
      "quest-log-end",
    ]);

    const reloaded = createProgressStore(() => storage);
    expect(reloaded.getSnapshot().found).toEqual(["title-screen", "quest-log-end"]);
    expect(reloaded.getSnapshot().announcement).toBe("");
  });

  it("announces each collect and ignores a repeat", () => {
    const store = createProgressStore(() => memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    store.collect("quest-board");
    expect(store.getSnapshot().announcement).toBe(
      collectAnnouncement("quest-board", ["quest-board"]),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    const before = store.getSnapshot();
    store.collect("quest-board");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(before);
  });

  it("returns the same snapshot object until something changes", () => {
    const store = createProgressStore(() => memoryStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.collect("quest-loot");
    const after = store.getSnapshot();
    expect(after).toBe(store.getSnapshot());
  });

  it("raises the achievement on the last shard, and dismisses it", () => {
    const store = createProgressStore(() => memoryStorage());
    for (const id of ALL_IDS.slice(0, -1)) store.collect(id);
    expect(store.getSnapshot().achievement).toBe(false);
    store.collect(ALL_IDS[ALL_IDS.length - 1]);
    expect(store.getSnapshot()).toMatchObject({ found: ALL_IDS, achievement: true });
    store.dismissAchievement();
    expect(store.getSnapshot()).toMatchObject({ found: ALL_IDS, achievement: false });
  });

  it("does not raise the achievement when the set was already complete on load", () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: JSON.stringify(ALL_IDS) });
    expect(createProgressStore(() => storage).getSnapshot().achievement).toBe(false);
  });

  it("resets progress and storage and announces it", () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    for (const id of ALL_IDS) store.collect(id);
    store.reset();
    expect(store.getSnapshot()).toEqual({
      found: [],
      announcement: RESET_ANNOUNCEMENT,
      achievement: false,
    });
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("keeps working in memory when storage throws", () => {
    const store = createProgressStore(() => throwingStorage());
    expect(store.getSnapshot().found).toEqual([]);
    expect(() => store.collect("quest-board")).not.toThrow();
    expect(store.getSnapshot().found).toEqual(["quest-board"]);
    expect(() => store.reset()).not.toThrow();
    expect(store.getSnapshot().found).toEqual([]);
  });

  it("keeps working when even accessing storage throws, or there is none", () => {
    const blocked = createProgressStore(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    blocked.collect("title-screen");
    expect(blocked.getSnapshot().found).toEqual(["title-screen"]);

    const none = createProgressStore(() => null);
    none.collect("title-screen");
    expect(none.getSnapshot().found).toEqual(["title-screen"]);
  });

  it("syncs with other tabs through the storage event while subscribed", () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    otherTabWrites(PROGRESS_STORAGE_KEY, JSON.stringify(["quest-board", "quest-loot"]));
    expect(store.getSnapshot().found).toEqual(["quest-board", "quest-loot"]);
    expect(store.getSnapshot().announcement).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);

    // Unrelated keys and unchanged values are ignored.
    otherTabWrites("something-else", "[]");
    otherTabWrites(PROGRESS_STORAGE_KEY, JSON.stringify(["quest-loot", "quest-board"]));
    expect(listener).toHaveBeenCalledTimes(1);

    // `localStorage.clear()` in another tab (key null) clears progress.
    otherTabWrites(null, null);
    expect(store.getSnapshot().found).toEqual([]);

    unsubscribe();
    otherTabWrites(PROGRESS_STORAGE_KEY, JSON.stringify(["title-screen"]));
    expect(store.getSnapshot().found).toEqual([]);
  });

  it("merges a shard another tab saved in the meantime when collecting", () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    store.getSnapshot();
    // Another tab wrote, but this tab had no subscriber to hear the event.
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(["title-screen"]));
    store.collect("quest-board");
    expect(store.getSnapshot().found).toEqual(["title-screen", "quest-board"]);
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY) ?? "")).toEqual([
      "title-screen",
      "quest-board",
    ]);
  });
});
