import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Elements a {@link Label} can render as. */
export type LabelElement = "span" | "p" | "div" | "dt";

/** Props for {@link Label}. */
export interface LabelProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `span`. */
  as?: LabelElement;
  /** Shows a small decorative rune diamond before the text. */
  rune?: boolean;
}

/**
 * Small "HUD" label in uppercase, letter-spaced JetBrains Mono (for example `Player 1`,
 * `Quest 02`). Write the text in normal case; the uppercase is CSS only, so screen readers
 * read words, not letters. Not a form label: use `<label>` for inputs.
 */
export function Label({
  as: Element = "span",
  rune = false,
  className,
  children,
  ...props
}: LabelProps) {
  return (
    <Element
      className={cx(
        "inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-neon uppercase",
        className,
      )}
      {...props}
    >
      {rune && (
        <span
          aria-hidden="true"
          data-testid="label-rune"
          className="size-1.5 shrink-0 rotate-45 border border-neon shadow-glow-sm"
        />
      )}
      {children}
    </Element>
  );
}
