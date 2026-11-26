import type { ReactNode } from "react";
import { ParallaxLayer } from "@/components/ParallaxLayer";
import { RuneCircuit } from "@/components/RuneCircuit";
import { Label } from "@/components/ui/Label";
import { HEADER_CIRCUIT_OPACITY } from "@/lib/arcane-field";

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  title: string;
  /** Optional HUD label shown above the title (for example "Quest board"). */
  label?: string;
  children?: ReactNode;
}

/**
 * The `<h1>`, an optional HUD label above it and optional intro text at the top of a page.
 * From `lg` up, a faint decorative rune circuit sits in the free space to the right of the
 * header and drifts with a gentle parallax ({@link ParallaxLayer}, off under reduced motion).
 * It only spans the header's own height in otherwise empty space, so no text ever sits on it,
 * and it fits inside `main` at every `lg`+ width (no horizontal scrolling).
 */
export function PageHeader({ title, label, children }: PageHeaderProps) {
  return (
    <header className="relative mb-10 max-w-2xl">
      {/* Inset by more than the parallax range, so it never leaves the header's own height. */}
      <ParallaxLayer
        max={8}
        className="absolute inset-y-3 left-full -z-10 ml-8 hidden w-56 lg:block"
      >
        <RuneCircuit opacity={HEADER_CIRCUIT_OPACITY} className="size-full text-neon" />
      </ParallaxLayer>
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
