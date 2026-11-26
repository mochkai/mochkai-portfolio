import { cx } from "@/lib/cx";

/** Visual variants shared by {@link Button} and {@link ButtonLink}. */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Sizes shared by {@link Button} and {@link ButtonLink}. `md` is the default; `sm` is a compact
 * button with smaller text that still has a 44 px touch target. Pick a size instead of passing
 * padding or text-size utilities, which would conflict with the size's own.
 */
export type ButtonSize = "md" | "sm";

/**
 * Layout, type and motion shared by every variant and size. Hover/press effects last 150 ms. The
 * transition and the 1 px press exist only under `motion-safe:` (never a `motion-reduce:`
 * override racing a higher-specificity variant); `motion-reduce:transition-none` makes the
 * reduced state explicit.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold " +
  "motion-safe:transition-[background-color,border-color,box-shadow,color,transform] " +
  "motion-safe:duration-150 motion-safe:ease-out motion-safe:active:translate-y-px " +
  "motion-reduce:transition-none " +
  "disabled:pointer-events-none disabled:opacity-50";

/** Per-size padding, text size and minimum height. */
const SIZES: Record<ButtonSize, string> = {
  md: "px-5 py-2.5",
  sm: "min-h-11 px-3.5 py-2 text-sm",
};

/** Per-variant colors. Text pairs are listed with their contrast ratios in DESIGN.md. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-neon bg-neon/15 text-foreground shadow-glow hover:bg-neon/25 hover:shadow-glow-lg",
  secondary:
    "border border-neon/50 text-glow hover:border-neon hover:bg-neon/10 hover:shadow-glow-sm",
  ghost: "border border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
};

/**
 * Returns the class list for a button-styled element.
 *
 * @param variant - `primary` (glowing CTA), `secondary` (outlined) or `ghost` (text only).
 * @param className - Extra classes appended after the variant classes. Do not pass padding or
 * text size here; use `size`.
 * @param size - `md` (default) or the compact `sm`.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  className?: string,
  size: ButtonSize = "md",
): string {
  return cx(BASE, SIZES[size], VARIANTS[variant], className);
}
