const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats a `YYYY-MM` month as e.g. `Mar 2024`. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  // UTC keeps the month stable regardless of the server's timezone.
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Formats a date range, using `Present` for an open-ended (`null`) end. */
export function formatDateRange(startDate: string, endDate: string | null): string {
  return `${formatMonth(startDate)} – ${endDate ? formatMonth(endDate) : "Present"}`;
}
