import { Edge, Equipment, Level, ParameterThreshold, ThresholdConfig, Bands } from '../types';

export function inEdge(edge: Edge, value: number): boolean {
  return (edge.min === null || value >= edge.min) && (edge.max === null || value <= edge.max);
}

export function anyIn(bands: Edge[], value: number): boolean {
  return bands.some((e) => inEdge(e, value));
}

export function numOr(v: number | null, fallback: number): number {
  return v === null ? fallback : v;
}

// Resolve equipment thresholds to absolute values (multiply the relative
// motor-current edges by the equipment's rated current).
export function resolveThresholds(eq: Equipment): ThresholdConfig {
  const cur = eq.thresholds.current;
  const rate = eq.ratedCurrent;
  const mul = (e: Edge): Edge => ({ min: e.min === null ? null : e.min * rate, max: e.max === null ? null : e.max * rate });
  return {
    temperature: eq.thresholds.temperature,
    vibration: eq.thresholds.vibration,
    voltage: eq.thresholds.voltage,
    current: {
      unit: cur.unit,
      relative: false,
      bands: {
        normal: cur.bands.normal.map(mul),
        warning: cur.bands.warning.map(mul),
        critical: cur.bands.critical.map(mul)
      }
    }
  };
}

export function classifyValue(th: ParameterThreshold, value: number): Level {
  if (anyIn(th.bands.critical, value)) return 'critical';
  if (anyIn(th.bands.warning, value)) return 'warning';
  return 'normal';
}

export function fmtEdge(e: Edge): string {
  if (e.min !== null && e.max !== null) return `${e.min}–${e.max}`;
  if (e.min !== null) return `> ${e.min}`;
  if (e.max !== null) return `< ${e.max}`;
  return 'any';
}

// Human description of a band set, e.g. "Normal < 70 °C · Warning 70–85 °C · Critical > 85 °C"
export function describeThresholds(th: ParameterThreshold): string {
  const p = (s: string) => (s ? s : '').replace(/^> /, 'over ').replace(/^< /, 'under ');
  const j = (bands: Edge[]) => bands.map(fmtEdge).join(' or ');
  return `Normal ${p(j(th.bands.normal))} · Warning ${p(j(th.bands.warning))} · Critical ${p(j(th.bands.critical))}`;
}

export function bandNote(th: ParameterThreshold, value: number, level: Level): string {
  const unit = th.unit;
  switch (level) {
    case 'critical':
      return `Value ${round2(value)} ${unit} reached the critical band (${describeThresholds(th)}).`;
    case 'warning':
      return `Value ${round2(value)} ${unit} is in the warning band (${describeThresholds(th)}).`;
    default:
      return `Value ${round2(value)} ${unit} is within the acceptable range (${describeThresholds(th)}).`;
  }
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function defaultBands(): Bands {
  return { normal: [], warning: [], critical: [] };
}