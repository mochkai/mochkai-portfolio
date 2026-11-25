import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

/** Props for {@link ButtonLink}: every `next/link` prop plus a visual variant. */
export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  /** `primary` for the one main action, `secondary` for alternatives, `ghost` for low emphasis. */
  variant?: ButtonVariant;
}

/** A `next/link` that looks like a {@link Button}. Use it for calls to action that navigate. */
export function ButtonLink({ variant = "primary", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
