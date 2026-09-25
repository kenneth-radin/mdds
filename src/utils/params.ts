import { Condition, Level, ParameterKey, Severity } from '../types';

export interface ParamMeta {
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  warningColor: string;
}

export const PARAM_META: Record<ParameterKey, ParamMeta> = {
  temperature: { label: 'Temperature', shortLabel: 'Temp', unit: '°C', color: '#f97316', warningColor: '#ef4444' },
  vibration:   { label: 'Vibration',   shortLabel: 'Vib',  unit: 'mm/s', color: '#8b5cf6', warningColor: '#ec4899' },
  voltage:     { label: 'Voltage',     shortLabel: 'Volt', unit: 'V',    color: '#3b82f6', warningColor: '#eab308' },
  current:     { label: 'Motor Current', shortLabel: 'Cur', unit: 'A',  color: '#10b981', warningColor: '#f59e0b' }
};

export const PARAM_ORDER: ParameterKey[] = ['temperature', 'vibration', 'voltage', 'current'];

export function levelLabel(l: Level): string {
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export function levelBadgeClass(l: Level): string {
  return {
    normal: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700'
  }[l];
}

export function conditionStyle(c: Condition): { bg: string; text: string; dot: string; label: string } {
  switch (c) {
    case 'NORMAL':
      return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Normal' };
    case 'WARNING':
      return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Warning' };
    case 'CRITICAL':
      return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Critical' };
    case 'OFFLINE':
    default:
      return { bg: 'bg-gray-200', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Offline' };
  }
}

export function conditionHex(c: Condition): string {
  return { NORMAL: '#16a34a', WARNING: '#f59e0b', CRITICAL: '#dc2626', OFFLINE: '#6b7280' }[c];
}

export function severityStyle(s: Severity): string {
  return {
    low: 'bg-sky-100 text-sky-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700'
  }[s];
}

export function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}