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
