import { z } from 'zod';

// Accepts a full ISO 8601 timestamp (`2025-01-20T08:30:00.000Z`) or a plain
// calendar date (`2025-01-20`) as typed by users on the mobile forms.
const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Zod schema for a date/datetime string. Use this instead of
 * `z.string().datetime()` so that date-only input is not rejected.
 */
export const dateString = z.string().refine(
  (value) => {
    const trimmed = value.trim();
    if (!DATE_PATTERN.test(trimmed)) return false;

    const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      // Rejects impossible calendar dates such as 2025-02-31, which Date
      // silently rolls over to 2025-03-03.
      return (
        date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      );
    }

    return Number.isFinite(Date.parse(trimmed));
  },
  { message: 'Expected an ISO 8601 datetime (2025-01-20T08:30:00.000Z) or a date (2025-01-20).' }
);

/** Converts a validated date/datetime string into a Date, or null when absent/invalid. */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) ? date : null;
}
