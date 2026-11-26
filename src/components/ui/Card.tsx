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

/**
 * Panel, rune line and inner light, with no padding and no `position`. For surfaces that set
 * their own positioning (`fixed`, `absolute`, `sticky`): combining {@link CARD_SURFACE} with one
 * of those would depend on stylesheet order, because `.relative` is emitted after `.fixed`. The
 * caller's positioning must not be `static`, or the `::before` rune line escapes the panel.
 */
export const CARD_PANEL =
  "rounded-xl border border-line bg-surface inset-shadow-rune " +
  "before:pointer-events-none before:absolute before:inset-2 before:rounded-lg " +
  "before:border before:border-dashed before:border-neon/15 before:content-['']";

/**
 * Panel, rune line and inner light, without padding: {@link CARD_PANEL} positioned `relative`.
 * The rune line is a decorative `::before`, invisible to AT. Exported for surfaces that cannot
 * be a {@link Card} element, such as a `<details>` disclosure whose `<summary>` must fill the
 * panel edge to edge. Never add another position class to it; use {@link CARD_PANEL} instead.
 */
export const CARD_SURFACE = `relative ${CARD_PANEL}`;

/** {@link CARD_SURFACE} plus the default padding. */
const BASE = `${CARD_SURFACE} p-6 sm:p-7`;

/**
 * Hover and focus-within glow, 150 ms, no transition under reduced motion. Exported with
 * {@link CARD_SURFACE} for interactive surfaces that are not a {@link Card}.
 */
export const CARD_INTERACTIVE =
  "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150 motion-safe:ease-out " +
  "motion-reduce:transition-none " +
  "hover:border-neon/60 hover:shadow-glow focus-within:border-neon/60 focus-within:shadow-glow";

/**
 * Slate panel with a thin line border and an inner dashed "rune" line, the base surface
 * for grouped content (projects, roles, stats).
 */
export function Card({ as: Element = "div", interactive = false, className, ...props }: CardProps) {
  const classes = cx(BASE, interactive && CARD_INTERACTIVE, className);
  return <Element className={classes} data-interactive={interactive || undefined} {...props} />;
}
