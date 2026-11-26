import { Label } from "@/components/ui/Label";
import type { ProjectStatus } from "@/lib/projects";

/** HUD text for each {@link ProjectStatus}, in normal case (the `Label` uppercases it). */
export const PROJECT_STATUS_TEXT: Record<ProjectStatus, string> = {
  complete: "Quest complete",
  active: "Active quest",
};

/** Props for {@link ProjectStatusLabel}. */
export interface ProjectStatusLabelProps {
  status: ProjectStatus;
  className?: string;
}

/**
 * HUD label with a rune marker for a project's status: "Quest complete" or "Active quest".
 * It replaces the date range that projects used to show; it reveals no date or duration.
 */
export function ProjectStatusLabel({ status, className }: ProjectStatusLabelProps) {
  return (
    <Label as="p" rune className={className}>
      {PROJECT_STATUS_TEXT[status]}
    </Label>
  );
}
