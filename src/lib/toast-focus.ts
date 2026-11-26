import type { RefObject } from "react";

/**
 * Runs `action` (which hides a toast), then, if focus was inside the toast, moves it back to
 * `returnFocus` so it is not dropped to the document body. Toasts never take focus themselves;
 * this only repairs focus when the visitor had moved into one.
 *
 * @param toast - The toast element.
 * @param returnFocus - Where focus was when the toast opened.
 * @param action - Hides the toast (dismiss, reset, ...).
 */
export function closeToast(
  toast: RefObject<HTMLElement | null>,
  returnFocus: RefObject<HTMLElement | null>,
  action: () => void,
): void {
  const hadFocus = toast.current?.contains(document.activeElement) ?? false;
  action();
  const target = returnFocus.current;
  if (hadFocus && target?.isConnected) target.focus();
}

/**
 * Whether an Escape press belongs to something else, so a toast must not close on it: another
 * handler already claimed it (`defaultPrevented`), or a modal dialog (such as the command
 * palette) is open and the press closes that instead.
 *
 * @param event - The Escape key press.
 */
export function isEscapeClaimed(event: Pick<KeyboardEvent, "defaultPrevented">): boolean {
  if (event.defaultPrevented) return true;
  try {
    return document.querySelector("dialog:modal") !== null;
  } catch {
    // Engines without `:modal`: no modal dialog can be detected.
    return false;
  }
}
