import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

/** Props for {@link ButtonLink}: every `next/link` prop plus a visual variant. */
export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  /** `primary` for the one main action, `secondary` for alternatives, `ghost` for low emphasis. */
  variant?: ButtonVariant;
  /** `md` (default) or the compact `sm` (smaller text, still a 44 px target). */
  size?: ButtonSize;
}

/** A `next/link` that looks like a {@link Button}. Use it for calls to action that navigate. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className, size)} {...props} />;
}
