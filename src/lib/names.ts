/**
 * The comparison key for technology, skill and company names: trimmed and lowercased, so
 * `"React"` and `" react "` are the same name. Shared by the profile schema (unique skill
 * names), the stats (distinct counts) and the skill tree (`/projects?tech=` matching).
 *
 * @param value - A name as written in the content data or a URL.
 * @returns The normalized key (empty for a blank name).
 */
export function toNameKey(value: string): string {
  return value.trim().toLowerCase();
}
