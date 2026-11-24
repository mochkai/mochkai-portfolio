"use client";

import { useEffect } from "react";
import type { ErrorPageProps } from "./error";
import "./globals.css";

/**
 * Last-resort error boundary for failures in the root layout itself (for example the
 * profile failing to load). It replaces the root layout, so it renders its own `<html>` and
 * `<body>` and imports the global styles; the layout's fonts are not loaded here, so text
 * falls back to the system sans-serif stack.
 */
export default function GlobalError({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <title>Something went wrong</title>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-xl" role="alert">
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-4 text-lg text-muted">
              The site could not be loaded. Try again, and if it keeps failing, come back later.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-8 rounded-sm bg-accent px-4 py-2 font-medium text-accent-foreground hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
