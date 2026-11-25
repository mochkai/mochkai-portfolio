import { Tag } from "@/components/ui/Tag";

/** Props for {@link TechList}. */
export interface TechListProps {
  items: readonly string[];
  /** Accessible name for the list, e.g. "Technologies used". */
  label?: string;
}

/** Inline list of technology names rendered as {@link Tag} chips. */
export function TechList({ items, label = "Technologies" }: TechListProps) {
  if (items.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Tag>{item}</Tag>
        </li>
      ))}
    </ul>
  );
}
