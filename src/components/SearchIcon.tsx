/** Props for {@link SearchIcon}. */
export interface SearchIconProps {
  /** Size and color classes (it draws in `currentColor`). */
  className?: string;
}

/** A decorative magnifier glyph (`aria-hidden`), drawn in `currentColor`. */
export function SearchIcon({ className }: SearchIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m12.5 12.5 4.5 4.5" />
    </svg>
  );
}
