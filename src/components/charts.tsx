import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export interface TrendSeries {
  dataKey: string;
  stroke: string;
  name: string;
}

export function TrendLineChart(props: {
  rows: Record<string, unknown>[];
  series: TrendSeries[];
  xKey?: string;
  height?: number;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer height={props.height || 300} minWidth={0} minHeight={0}>
        <LineChart data={props.rows}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={props.xKey || 'label'} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={48} interval="preserveStartEnd" height={36} tickMargin={4} />
          <YAxis width={48} />
          <Tooltip />
          {props.series.map((s) => (
            <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={s.stroke} strokeWidth={2} dot={false} name={s.name} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 grid max-w-full grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
        {props.series.map((t) => (
          <span key={t.dataKey} className="inline-flex min-w-0 items-center gap-1">
            <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ backgroundColor: t.stroke }} />
            <span className="break-words text-slate-600">{t.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SimpleBarChart(props: {
  data: { label: string; value: number }[];
  colorFn?: (label: string) => string;
  height?: number;
  dataKey?: string;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer height={props.height || 260} minWidth={0} minHeight={0}>
        <BarChart data={props.data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis width={44} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Bar dataKey={props.dataKey || 'value'} radius={6} isAnimationActive={false}>
            {(props.data).map((d) => (
              <Cell key={d.label} fill={props.colorFn ? props.colorFn(d.label) : '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Custom SVG condition-score gauge (green → amber → red).
export function ConditionGauge(props: { value: number; label?: string; size?: number; unit?: string }) {
  const size = props.size || 170;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const stroke = 16;
  const C = 2 * Math.PI * r;
  const dash = (props.value / 100) * C;
  const color = props.value >= 90 ? '#22c55e' : props.value >= 75 ? '#84cc16' : props.value >= 50 ? '#eab308' : props.value >= 30 ? '#f97316' : '#dc2626';
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, maxWidth: "100%" }} className="mx-auto block h-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.5s', stroke: color }}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.16} fontWeight="700" fill="#0f172a">
        {Math.round(props.value)}
      </text>
      <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.055} fill="#64748b">
        {props.unit || '/ 100'}
      </text>
      <text x={cx} y={cy + size * 0.19} textAnchor="middle" fontSize={size * 0.06} fill={color}>
        {props.label || ''}
      </text>
    </svg>
  );
}

export function Donut(props: { segments: { label: string; value: number; color: string }[]; size?: number; centerLabel?: string }) {
  const size = props.size || 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const stroke = 22;
  const C = 2 * Math.PI * r;
  const total = props.segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  const nodes = props.segments.filter((s) => s.value > 0).map((s) => {
    const frac = s.value / total;
    const offset = -acc / total * C;
    acc += s.value;
    const dash = frac * C;
    return { ...s, dash, offset };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, maxWidth: "100%" }} className="mx-auto block h-auto">
      {nodes.map((s, i) => (
        <circle
          key={s.label + i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${Math.max(s.dash - 2, 0)} ${C}`}
          strokeDashoffset={s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <text x={cx} y={cy} textAnchor="middle" fontSize={size * 0.1} fontWeight="700" fill="#0f172a">
        {props.centerLabel || String(Math.round(total))}
      </text>
    </svg>
  );
}

export function Sparkline(props: { data: number[]; color?: string; width?: number; height?: number }) {
  if (props.data.length < 2) return null;
  const w = props.width || 120;
  const h = props.height || 34;
  const min = Math.min(...props.data);
  const max = Math.max(...props.data);
  const span = max - min || 1;
  const step = w / (props.data.length - 1);
  const pts = props.data.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <polyline points={pts.join(' ')} fill="none" stroke={props.color || '#6366f1'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}