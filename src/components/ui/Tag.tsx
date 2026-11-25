import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Props for {@link Tag}. */
export type TagProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Item-style chip in JetBrains Mono for a technology or skill. Static, not interactive.
 * For a list of tags use `TechList`, which adds the list semantics and accessible name.
 */
export function Tag({ className, ...props }: TagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border border-line bg-background/40 px-2.5 py-1 font-mono text-xs leading-none text-glow",
        className,
      )}
      {...props}
    />
  );
}
