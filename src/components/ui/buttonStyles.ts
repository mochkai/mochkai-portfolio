import { cx } from "@/lib/cx";

/** Visual variants shared by {@link Button} and {@link ButtonLink}. */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/** Layout, type and motion shared by every variant. Hover/press effects last 150 ms. */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-display font-semibold " +
  "transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out " +
  "active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 " +
  "disabled:pointer-events-none disabled:opacity-50";

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
 * @param className - Extra classes appended after the variant classes.
 */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cx(BASE, VARIANTS[variant], className);
}
