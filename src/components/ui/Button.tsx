import type { ButtonHTMLAttributes } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

/** Props for {@link Button}: every native `<button>` attribute plus a visual variant. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` for the one main action, `secondary` for alternatives, `ghost` for low emphasis. */
  variant?: ButtonVariant;
  /** `md` (default) or the compact `sm` (smaller text, still a 44 px target). */
  size?: ButtonSize;
}

/**
 * Native `<button>` in the Arcane Tech style. Defaults to `type="button"` so it never
 * submits a form by accident. Use {@link ButtonLink} for navigation.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className, size)} {...props} />;
}
