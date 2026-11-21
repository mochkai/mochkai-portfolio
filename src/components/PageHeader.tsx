import type { ReactNode } from "react";

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

/** The `<h1>` and optional intro text at the top of a page. */
export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="mb-10 max-w-2xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 text-lg leading-relaxed text-muted">{children}</div>}
    </header>
  );
}
