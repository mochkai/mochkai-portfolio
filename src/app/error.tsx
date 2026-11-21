"use client";

import { useEffect } from "react";

/** Props passed by Next.js to an error boundary. */
export interface ErrorPageProps {
  error: unknown;
  /** Re-fetches and re-renders the failed segment. */
  retry: () => void;
}

/** Route-level error boundary with a retry action. */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl" role="alert">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        This page failed to load
      </h1>
      <p className="mt-4 text-lg text-muted">
        The content could not be loaded. Try again, and if it keeps failing, come back later.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-8 rounded-sm bg-accent px-4 py-2 font-medium text-accent-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
