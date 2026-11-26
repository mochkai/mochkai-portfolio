import { afterEach, describe, expect, it } from "vitest";
import {
  KONAMI_SEQUENCE,
  LOGO_RAPID_CLICKS,
  advanceSequence,
  createSequenceMatcher,
  isEditableTarget,
  isModifiedKeyPress,
  normalizeKey,
  registerRapidClick,
  type KeyPress,
} from "./konami";

/** Feeds `keys` to a fresh matcher and returns whether each press completed the sequence. */
function run(keys: readonly string[]): boolean[] {
  const matcher = createSequenceMatcher();
  return keys.map((key) => matcher.push(key));
}

/** The sequence as raw `KeyboardEvent.key` values. */
const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

describe("KONAMI_SEQUENCE", () => {
  it("is Up Up Down Down Left Right Left Right B A", () => {
    expect(KONAMI_SEQUENCE).toEqual(CODE);
  });
});

describe("normalizeKey", () => {
  it("lowercases single characters and keeps named keys", () => {
    expect(normalizeKey("B")).toBe("b");
    expect(normalizeKey("a")).toBe("a");
    expect(normalizeKey("ArrowUp")).toBe("ArrowUp");
  });
});

describe("advanceSequence", () => {
  it("counts each correct key", () => {
    let matched = 0;
    CODE.forEach((key, i) => {
      matched = advanceSequence(matched, key);
      expect(matched).toBe(i + 1);
    });
  });

  it("drops to 0 on a key that cannot start the sequence", () => {
    expect(advanceSequence(5, "x")).toBe(0);
    expect(advanceSequence(0, "ArrowDown")).toBe(0);
  });

  it("falls back to the longest valid start instead of always starting over", () => {
    // Up Up, then a third Up: still "Up Up" matched.
    expect(advanceSequence(2, "ArrowUp")).toBe(2);
    // A wrong key that is itself the first key of the sequence.
    expect(advanceSequence(4, "ArrowUp")).toBe(1);
  });

  it("starts over after a completed match and accepts out-of-range input", () => {
    expect(advanceSequence(CODE.length, "ArrowUp")).toBe(1);
    expect(advanceSequence(-3, "ArrowUp")).toBe(1);
  });

  it("works with any sequence", () => {
    expect(advanceSequence(0, "x", ["x", "y"])).toBe(1);
    expect(advanceSequence(1, "y", ["x", "y"])).toBe(2);
  });
});

describe("createSequenceMatcher", () => {
  it("fires on the full sequence only, on its last key", () => {
    const results = run(CODE);
    expect(results.slice(0, -1).every((result) => !result)).toBe(true);
    expect(results.at(-1)).toBe(true);
  });

  it("accepts upper-case B and A (Caps Lock)", () => {
    expect(run([...CODE.slice(0, 8), "B", "A"]).at(-1)).toBe(true);
  });

  it("never fires on a partial sequence", () => {
    for (let length = 1; length < CODE.length; length++) {
      expect(run(CODE.slice(0, length))).not.toContain(true);
    }
  });

  it("never fires on a wrong sequence", () => {
    expect(run([...CODE.slice(0, 8), "a", "b"])).not.toContain(true);
    expect(run([...CODE.slice(0, 5), "x", ...CODE.slice(5)])).not.toContain(true);
    expect(run([...CODE].reverse())).not.toContain(true);
  });

  it("fires after a false start and again on a second entry", () => {
    expect(run(["ArrowUp", "ArrowUp", ...CODE]).at(-1)).toBe(true);
    expect(run([...CODE, ...CODE]).filter(Boolean)).toHaveLength(2);
  });

  it("forgets progress on reset", () => {
    const matcher = createSequenceMatcher();
    CODE.slice(0, 9).forEach((key) => matcher.push(key));
    expect(matcher.progress).toBe(9);
    matcher.reset();
    expect(matcher.progress).toBe(0);
    expect(matcher.push("a")).toBe(false);
  });
});

describe("isModifiedKeyPress", () => {
  const plain: KeyPress = {
    key: "ArrowUp",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
  };

  it("lets plain key presses through", () => {
    expect(isModifiedKeyPress(plain)).toBe(false);
  });

  it.each(["altKey", "ctrlKey", "metaKey", "shiftKey", "repeat", "isComposing"] as const)(
    "ignores presses with %s",
    (flag) => {
      expect(isModifiedKeyPress({ ...plain, [flag]: true })).toBe(true);
    },
  );
});

describe("isEditableTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is true for inputs, textareas, selects and contenteditable regions", () => {
    document.body.innerHTML = `
      <input id="input" />
      <textarea id="textarea"></textarea>
      <select id="select"><option>One</option></select>
      <div contenteditable="true"><span id="editable">Text</span></div>
      <div contenteditable=""><b id="empty-attr">Text</b></div>`;
    for (const id of ["input", "textarea", "select", "editable", "empty-attr"]) {
      expect(isEditableTarget(document.getElementById(id))).toBe(true);
    }
  });

  it("is false for the page, links, buttons and non-editable regions", () => {
    document.body.innerHTML = `
      <a id="link" href="/">Home</a>
      <button id="button" type="button">Go</button>
      <div contenteditable="false"><span id="locked">Text</span></div>`;
    for (const id of ["link", "button", "locked"]) {
      expect(isEditableTarget(document.getElementById(id))).toBe(false);
    }
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});

describe("registerRapidClick", () => {
  /** Clicks at each timestamp and returns whether each one triggered. */
  function clicks(times: readonly number[]): boolean[] {
    let kept: number[] = [];
    return times.map((now) => {
      const result = registerRapidClick(kept, now);
      kept = result.times;
      return result.triggered;
    });
  }

  it("defaults to 5 clicks within 2 seconds", () => {
    expect(LOGO_RAPID_CLICKS).toEqual({ count: 5, windowMs: 2000 });
  });

  it("triggers on the fifth quick click", () => {
    expect(clicks([0, 200, 400, 600, 800])).toEqual([false, false, false, false, true]);
  });

  it("does not trigger when the clicks are too slow", () => {
    expect(clicks([0, 600, 1200, 1800, 2400, 3000])).not.toContain(true);
  });

  it("needs a fresh burst to trigger again", () => {
    expect(clicks([0, 100, 200, 300, 400, 500, 600, 700, 800])).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("takes custom options", () => {
    expect(registerRapidClick([0], 50, { count: 2, windowMs: 100 }).triggered).toBe(true);
    expect(registerRapidClick([0], 150, { count: 2, windowMs: 100 }).triggered).toBe(false);
  });
});
