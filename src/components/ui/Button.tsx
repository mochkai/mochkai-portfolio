import type { ButtonHTMLAttributes } from "react";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

/** Props for {@link Button}: every native `<button>` attribute plus a visual variant. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` for the one main action, `secondary` for alternatives, `ghost` for low emphasis. */
  variant?: ButtonVariant;
}

/**
 * Native `<button>` in the Arcane Tech style. Defaults to `type="button"` so it never
 * submits a form by accident. Use {@link ButtonLink} for navigation.
 */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
