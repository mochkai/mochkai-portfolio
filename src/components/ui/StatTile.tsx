import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Props for {@link StatTile}. */
export interface StatTileProps {
  /** What the number counts, e.g. "Projects completed". Rendered as the `<dt>`. */
  label: ReactNode;
  /** The value, derived from content data, never invented. Rendered as the `<dd>`. */
  value: ReactNode;
  className?: string;
}

/**
 * Scoreboard tile: a mono HUD label over a large glowing value. Renders a `<div>` holding a
 * `<dt>`/`<dd>` pair, so it must sit inside a `<dl>`; use {@link StatGrid} for that.
 */
export function StatTile({ label, value, className }: StatTileProps) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-background/60 px-4 py-3",
        className,
      )}
    >
      <dt className="font-mono text-xs tracking-[0.2em] text-neon uppercase">{label}</dt>
      <dd className="font-display text-3xl font-bold break-words text-glow text-shadow-glow-sm">
        {value}
      </dd>
    </div>
  );
}
