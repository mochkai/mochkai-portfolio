import { cx } from "@/lib/cx";

/** Props for {@link CollectibleRune}. */
export interface CollectibleRuneProps {
  /** Filled (a found shard) or outline only (still hidden). */
  filled?: boolean;
  className?: string;
}

/**
 * Original artwork for a rune shard: a slanted crystal splinter with a stepped rune trace
 * carved into it. Drawn in `currentColor`, so the caller picks the token colour (`text-brand`,
 * `text-glow`). Always decorative (`aria-hidden`): the button around it carries the name.
 */
export function CollectibleRune({ filled = false, className }: CollectibleRuneProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={cx("shrink-0", className)}
    >
      <path
        d="M12.5 2 17.5 8.5 13.5 22 7 10.5Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.3 : undefined}
      />
      <path d="M12.3 6.5 10.6 10.6 13.6 12.6 12.2 17" />
    </svg>
  );
}
