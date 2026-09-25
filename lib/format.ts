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

export function toIsoOrNull(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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
  cases: 'No historical maintenance cases available.',
  testing: 'No testing cases recorded yet.',
  suggestions: 'Insufficient historical data for reliable analysis.'
};
