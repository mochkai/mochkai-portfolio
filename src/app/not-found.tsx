import Link from "next/link";

/** 404 page for unknown routes and missing projects. */
export default function NotFound() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-4 text-lg text-muted">
        This page does not exist or has moved. Check the address, or go back to the home page.
      </p>
      <p className="mt-8">
        <Link href="/" className="text-accent hover:underline">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}
