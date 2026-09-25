import React from 'react';
import { Condition, Level, Severity } from '../types';
import { conditionStyle, levelLabel } from '../utils/params';
import { X, Search, Info } from 'lucide-react';

export const inputCls =
  'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none';

export function Card(props: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm ' + (props.className || '')}>
      {(props.title || props.actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1 basis-48">
            {props.title && <h3 className="break-words text-sm font-semibold text-slate-800">{props.title}</h3>}
            {props.subtitle && <p className="mt-0.5 break-words text-xs text-slate-500">{props.subtitle}</p>}
          </div>
          {props.actions && <div className="flex flex-wrap items-center gap-2 min-w-0">{props.actions}</div>}
        </header>
      )}
      <div className={'min-w-0 overflow-hidden p-4 ' + (props.bodyClassName || '')}>{props.children}</div>
    </section>
  );
}

export function PageHeader(props: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">{props.title}</h1>
        {props.subtitle && <p className="text-sm text-slate-500 mt-1">{props.subtitle}</p>}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2 min-w-0">{props.actions}</div>}
    </div>
  );
}

export function ConditionBadge(props: { status: Condition; label?: string }) {
  const s = conditionStyle(props.status);
  return (
    <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ' + s.bg + ' ' + s.text}>
      <span className={'inline-block h-1.5 w-1.5 rounded-full ' + s.dot} />
      {props.label || s.label}
    </span>
  );
}

export function LevelBadge(props: { level: Level }) {
  const base = props.level === 'critical' ? 'bg-red-100 text-red-700' : props.level === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return <span className={'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ' + base}>{levelLabel(props.level)}</span>;
}

export function SeverityBadge(props: { severity: Severity }) {
  const map: Record<Severity, string> = {
    low: 'bg-sky-100 text-sky-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700'
  };
  return <span className={'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ' + map[props.severity]}>{props.severity}</span>;
}

export function StatCard(props: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'gray' | 'indigo';
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-700',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-slate-500',
    indigo: 'text-indigo-600'
  };
  const bg: Record<string, string> = {
    slate: 'bg-slate-100',
    green: 'bg-emerald-100',
    amber: 'bg-amber-100',
    red: 'bg-red-100',
    gray: 'bg-slate-100',
    indigo: 'bg-indigo-100'
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{props.label}</p>
        {props.icon && <span className={'inline-flex h-6 w-6 items-center justify-center rounded-lg ' + bg[props.tone || 'slate']}>{props.icon}</span>}
      </div>
      <p className={'mt-1 text-2xl font-bold ' + tones[props.tone || 'slate']}>{props.value}</p>
      {props.sub && <p className="mt-0.5 text-xs text-slate-400">{props.sub}</p>}
    </div>
  );
}
export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={props.onClose}>
      <div className={(props.wide ? 'w-full max-w-3xl ' : 'w-full max-w-lg ') + 'max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-2xl'} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-800">{props.title}</h3>
          <button type="button" onClick={props.onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">{props.children}</div>
        {props.footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">{props.footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState(props: { title: string; message?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{props.icon}</div>
      <p className="font-medium text-slate-700">{props.title}</p>
      {props.message && <p className="text-sm text-slate-500">{props.message}</p>}
      {props.action && <div>{props.action}</div>}
    </div>
  );
}

export function Field(props: { label: string; children: React.ReactNode; hint?: string; required?: boolean; colSpan?: number }) {
  return (
    <label className={(props.colSpan ? 'col-span-' + props.colSpan + ' ' : '') + 'block'}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {props.label}
        {props.required && <span className="text-red-500"> *</span>}
      </span>
      {props.children}
      {props.hint && <span className="mt-1 block text-[11px] text-slate-400">{props.hint}</span>}
    </label>
  );
}

export function SearchInput(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder || 'Search…'}
        className={inputCls + ' pl-8'}
      />
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
    </div>
  );
}

export function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100'
  };
  const size = props.size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type={props.type || 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
      className={'inline-flex items-center gap-1.5 rounded-lg font-medium transition ' + size + ' ' + variants[props.variant || 'primary'] + (props.disabled ? ' opacity-50 pointer-events-none' : '')}
    >
      {props.children}
    </button>
  );
}

export function Tabs(props: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {props.tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => props.onChange(t.key)}
          className={'rounded-md px-3 py-1.5 text-sm font-medium ' + (t.key === props.active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1 text-xs opacity-70">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function SimpleTable(props: { headers: string[]; rows: (string | number)[][]; empty?: string }) {
  if (props.rows.length === 0) {
    return <EmptyState title={props.empty || 'Nothing to show'} icon={<Info className="h-6 w-6" />} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            {props.headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {props.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => <td key={ci} className="px-3 py-2 text-slate-700">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
