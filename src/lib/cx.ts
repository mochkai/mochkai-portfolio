/** A class name, or a falsy value to skip it (for conditional classes). */
export type ClassValue = string | false | null | undefined;

/**
 * Joins class names with a space, skipping falsy values.
 *
 * @example cx("base", active && "active", className)
 */
export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
