import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Props for {@link StatGrid}. */
export interface StatGridProps {
  /** Accessible name for the group of stats, e.g. "Character stats". */
  label: string;
  /** `StatTile` elements. */
  children: ReactNode;
  className?: string;
}

/** Responsive `<dl>` grid of {@link StatTile}s: tiles at least 10rem wide, as many per row as fit. */
export function StatGrid({ label, children, className }: StatGridProps) {
  return (
    <dl
      aria-label={label}
      className={cx("grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3", className)}
    >
      {children}
    </dl>
  );
}
