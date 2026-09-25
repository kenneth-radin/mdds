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
    return DATE_PATTERN.test(trimmed) && Number.isFinite(Date.parse(trimmed));
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
