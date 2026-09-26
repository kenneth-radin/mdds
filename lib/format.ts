export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function fmtNumber(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number(value).toFixed(digits);
}

export function fmtInt(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

/**
 * Converts user-entered date text into an ISO timestamp.
 * Returns null for empty or unparseable input.
 *
 * Date-only text (`2025-01-20`) is parsed explicitly instead of relying on
 * the platform's `Date` string parsing, which differs between engines
 * (Hermes on device vs V8 during development).
 */
export function toIsoOrNull(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  const dateOnly = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Rejects impossible calendar dates such as 2025-02-31.
    const roundTrips =
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return roundTrips ? date.toISOString() : null;
  }

  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/** True when the text is a usable date or datetime. Empty text is treated as "not provided". */
export function isValidDateInput(value: string): boolean {
  return toIsoOrNull(value) !== null;
}

/**
 * Converts user-entered numeric text into a number.
 * Blank text means "not provided" and becomes null. Text that is not a finite
 * number also becomes null, so callers must check isValidNumberInput first -
 * otherwise Number('abc') serialises to null and is rejected by the API.
 */
export function toNumberOrNull(value: string): number | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when the text is blank (not provided) or a finite number. */
export function isValidNumberInput(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return true;
  return Number.isFinite(Number(trimmed));
}

export function splitCsv(value: string): string[] {
  return (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const EMPTY = {
  machines: 'No machines registered yet.',
  maintenance: 'No maintenance history available.',
  failures: 'No failure records available.',
  operational: 'No operational data recorded yet.',
  cases: 'No maintenance cases recorded yet.',
  testing: 'No testing cases recorded yet.',
  suggestions: 'Not enough similar past records to suggest a solution yet.'
};


/**
 * Converts enum-like values such as "partially-resolved" or "analyzed"
 * into clean, readable text such as "Partially resolved" or "Analyzed".
 */
export function humanize(value?: string | null): string {
  if (!value) return '—';
  const clean = value.replace(/[-_]+/g, ' ').trim();
  if (!clean) return '—';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}