import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Elements a {@link Card} can render as, so it fits the page outline. */
export type CardElement = "div" | "article" | "section" | "li";

/** Props for {@link Card}. */
export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `div`. */
  as?: CardElement;
  /**
   * Adds a neon border and glow on hover and when anything inside has keyboard focus.
   * Use it when the card contains a link or button, not as decoration.
   */
  interactive?: boolean;
}

/** Panel, rune line and inner light. The rune line is a decorative `::before`, invisible to AT. */
const BASE =
  "relative rounded-xl border border-line bg-surface p-6 inset-shadow-rune sm:p-7 " +
  "before:pointer-events-none before:absolute before:inset-2 before:rounded-lg " +
  "before:border before:border-dashed before:border-neon/15 before:content-['']";

/** Hover and focus-within glow, 150 ms, no transition under reduced motion. */
const INTERACTIVE =
  "transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none " +
  "hover:border-neon/60 hover:shadow-glow focus-within:border-neon/60 focus-within:shadow-glow";

/**
 * Slate panel with a thin line border and an inner dashed "rune" line, the base surface
 * for grouped content (projects, roles, stats).
 */
export function Card({ as: Element = "div", interactive = false, className, ...props }: CardProps) {
  const classes = cx(BASE, interactive && INTERACTIVE, className);
  return <Element className={classes} data-interactive={interactive || undefined} {...props} />;
}
