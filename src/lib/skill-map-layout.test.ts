import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  createLayoutStore,
  parseLayout,
} from "./skill-map-layout";

/** A minimal in-memory `Storage`. */
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
    setItem: (key, value) => void data.set(key, value),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseLayout", () => {
  it("accepts the two layouts and falls back to Constellation for anything else", () => {
    expect(parseLayout("tree")).toBe("tree");
    expect(parseLayout("constellation")).toBe("constellation");
    expect(parseLayout(null)).toBe(DEFAULT_LAYOUT);
    expect(parseLayout("radial")).toBe("constellation");
  });
});

describe("createLayoutStore", () => {
  it("renders Constellation on the server and reads the stored layout on the client", () => {
    const store = createLayoutStore(() => memoryStorage({ [LAYOUT_STORAGE_KEY]: "tree" }));
    expect(store.getServerSnapshot()).toBe("constellation");
    expect(store.getSnapshot()).toBe("tree");
  });

  it("saves a change and notifies listeners once", () => {
    const storage = memoryStorage();
    const store = createLayoutStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("tree");
    store.set("tree");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(storage.getItem(LAYOUT_STORAGE_KEY)).toBe("tree");
    expect(store.getSnapshot()).toBe("tree");
    unsubscribe();
  });

  it("keeps working in memory when storage throws", () => {
    const store = createLayoutStore(() => {
      throw new Error("blocked");
    });
    expect(store.getSnapshot()).toBe("constellation");
    store.set("tree");
    expect(store.getSnapshot()).toBe("tree");
  });

  it("follows a change made in another tab", () => {
    const store = createLayoutStore(() => memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "x" }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(
      new StorageEvent("storage", { key: LAYOUT_STORAGE_KEY, newValue: "tree" }),
    );
    expect(store.getSnapshot()).toBe("tree");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
