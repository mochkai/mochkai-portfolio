/**
 * Key-sequence matching for the hidden "overdrive" input (#13): the classic cheat-code sequence
 * Up Up Down Down Left Right Left Right B A. Only the generic key sequence is used; no names,
 * art or sounds from any game.
 *
 * Everything here is pure except {@link isEditableTarget}, which only reads the DOM element it
 * is given.
 */

/** The secret input, as normalized keys (see {@link normalizeKey}). */
export const KONAMI_SEQUENCE: readonly string[] = Object.freeze([
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
]);

/**
 * Normalizes a `KeyboardEvent.key` value for matching: single characters are lowercased (so
 * Caps Lock still works), named keys such as `ArrowUp` are kept as they are.
 *
 * @param key - The `key` of a keyboard event.
 */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Advances a sequence match by one key press.
 *
 * A wrong key does not always start over: like a string search, the match falls back to the
 * longest part of what was typed that is still a valid start of the sequence (so "Up Up Up Down
 * Down ..." still matches). A completed match counts as a fresh start.
 *
 * @param matched - How many keys of `sequence` were matched so far (0 to `sequence.length`).
 * @param key - The key just pressed (normalized or raw `KeyboardEvent.key`).
 * @param sequence - The sequence to match; defaults to {@link KONAMI_SEQUENCE}.
 * @returns The new match length. It equals `sequence.length` when the sequence was completed.
 */
export function advanceSequence(
  matched: number,
  key: string,
  sequence: readonly string[] = KONAMI_SEQUENCE,
): number {
  const start = matched >= sequence.length || matched < 0 ? 0 : Math.floor(matched);
  const typed = [...sequence.slice(0, start), normalizeKey(key)];
  // The longest suffix of what was typed that is also a prefix of the sequence.
  for (let length = typed.length; length > 0; length--) {
    const offset = typed.length - length;
    let fits = true;
    for (let i = 0; i < length; i++) {
      if (typed[offset + i] !== sequence[i]) {
        fits = false;
        break;
      }
    }
    if (fits) return length;
  }
  return 0;
}

/** A stateful matcher built on {@link advanceSequence}. */
export interface SequenceMatcher {
  /**
   * Feeds one key press.
   *
   * @returns `true` when this key completed the sequence (the matcher then starts over).
   */
  push(key: string): boolean;
  /** Forgets any partial match. */
  reset(): void;
  /** How many keys are currently matched (for tests). */
  readonly progress: number;
}

/**
 * Creates a matcher that remembers partial progress between key presses.
 *
 * @param sequence - The sequence to match; defaults to {@link KONAMI_SEQUENCE}.
 */
export function createSequenceMatcher(
  sequence: readonly string[] = KONAMI_SEQUENCE,
): SequenceMatcher {
  let matched = 0;
  return {
    push(key) {
      matched = advanceSequence(matched, key, sequence);
      if (matched < sequence.length) return false;
      matched = 0;
      return true;
    },
    reset() {
      matched = 0;
    },
    get progress() {
      return matched;
    },
  };
}

/** The parts of a keyboard event the listener looks at. */
export type KeyPress = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing"
>;

/**
 * Whether a key press is a modifier combination, an auto-repeat or part of an IME composition,
 * none of which count towards (or break) the sequence. Shortcuts such as Ctrl+A or Shift+Arrow
 * (text selection) are left alone.
 *
 * @param event - The key press.
 */
export function isModifiedKeyPress(event: KeyPress): boolean {
  return (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat ||
    event.isComposing
  );
}

/**
 * Whether the event target is somewhere the visitor types or uses arrow keys for the control
 * itself: inputs, textareas, selects and contenteditable regions. Key presses there never count.
 *
 * @param target - `KeyboardEvent.target`.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  // jsdom does not implement `isContentEditable`, so check the attribute as well.
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/** Options for {@link registerRapidClick}. */
export interface RapidClickOptions {
  /** Clicks needed within the window. */
  count: number;
  /** Length of the window in ms. */
  windowMs: number;
}

/** Default rapid-click rule for the logo egg: 5 clicks within 2 seconds. */
export const LOGO_RAPID_CLICKS: RapidClickOptions = Object.freeze({ count: 5, windowMs: 2000 });

/**
 * Records one click and reports whether it completed a burst of rapid clicks.
 *
 * @param times - Earlier click timestamps (ms), oldest first.
 * @param now - This click's timestamp (ms).
 * @param options - How many clicks within how long; defaults to {@link LOGO_RAPID_CLICKS}.
 * @returns The timestamps to keep for the next click (empty after a burst, so the egg needs a
 * fresh burst to fire again) and whether this click completed a burst.
 */
export function registerRapidClick(
  times: readonly number[],
  now: number,
  options: RapidClickOptions = LOGO_RAPID_CLICKS,
): { times: number[]; triggered: boolean } {
  const recent = [...times.filter((time) => now - time < options.windowMs && time <= now), now];
  if (recent.length >= options.count) return { times: [], triggered: true };
  return { times: recent, triggered: false };
}
