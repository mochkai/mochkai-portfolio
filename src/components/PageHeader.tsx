import type { ReactNode } from "react";
import { Label } from "@/components/ui/Label";

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  title: string;
  /** Optional HUD label shown above the title (for example "Quest board"). */
  label?: string;
  children?: ReactNode;
}

/** The `<h1>`, an optional HUD label above it and optional intro text at the top of a page. */
export function PageHeader({ title, label, children }: PageHeaderProps) {
  return (
    <header className="mb-10 max-w-2xl">
      {label && (
        <Label as="p" rune className="mb-4">
          {label}
        </Label>
      )}
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 text-lg leading-relaxed text-muted">{children}</div>}
    </header>
  );
}
