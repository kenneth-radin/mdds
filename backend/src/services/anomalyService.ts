import { ISensorReading } from '../models/SensorReading';

export type ParameterKey = 'temperature' | 'vibration';

export interface Edge {
  min: number | null;
  max: number | null;
}

export interface ThresholdParam {
  unit: string;
  bands: {
    normal: Edge[];
    warning: Edge[];
    critical: Edge[];
  };
}

export interface AnomalyResult {
  anomaly: boolean;
  severity: 'normal' | 'warning' | 'critical';
  parameter: ParameterKey;
  parameterLabel: string;
  reason: string;
  suggestion: string;
}

const PARAM_LABELS: Record<ParameterKey, string> = {
  temperature: 'Temperature',
  vibration: 'Vibration'
};

const SUGGESTIONS: Record<ParameterKey, string> = {
  temperature: 'Inspect the cooling system, check ventilation and fan airflow.',
  vibration: 'Inspect motor bearings, couplings and rotor balance.'
};

const SPIKE_RELATIVE: Record<ParameterKey, number> = { temperature: 0.3, vibration: 0.3 };
const SPIKE_ABSOLUTE: Record<ParameterKey, number> = { temperature: 8, vibration: 1.0 };
const SUSTAINED_MIN = 5;

export const DEFAULT_THRESHOLDS: Record<ParameterKey, ThresholdParam> = {
  temperature: {
    unit: '°C',
    bands: { normal: [{ min: null, max: 70 }], warning: [{ min: 70, max: 85 }], critical: [{ min: 85, max: null }] }
  },
  vibration: {
    unit: 'mm/s',
    bands: { normal: [{ min: null, max: 2.8 }], warning: [{ min: 2.8, max: 4.5 }], critical: [{ min: 4.5, max: null }] }
  }
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classifyValue(th: ThresholdParam, value: number): 'normal' | 'warning' | 'critical' {
  if (th.bands.critical.some((e) => (e.min === null || value >= e.min) && (e.max === null || value <= e.max))) return 'critical';
  if (th.bands.warning.some((e) => (e.min === null || value >= e.min) && (e.max === null || value <= e.max))) return 'warning';
  return 'normal';
}

function isSpike(val: number, baseline: number, key: ParameterKey): boolean {
  if (!Number.isFinite(baseline) || baseline <= 0) return false;
  const relative = Math.abs(val - baseline) / baseline;
  const absolute = Math.abs(val - baseline);
  return relative > SPIKE_RELATIVE[key] || absolute > SPIKE_ABSOLUTE[key];
}

export class AnomalyDetector {
  analyze(reading: ISensorReading, history: ISensorReading[], thresholds: typeof DEFAULT_THRESHOLDS): AnomalyResult {
    const tempResult = this.detectParameter(reading.temperature, reading, history, 'temperature', thresholds.temperature);
    const vibResult = this.detectParameter(reading.vibration, reading, history, 'vibration', thresholds.vibration);
    const results = [tempResult, vibResult].filter((r) => r.anomaly);
    if (results.length === 0) {
      return {
        anomaly: false,
        severity: 'normal',
        parameter: 'temperature',
        parameterLabel: PARAM_LABELS.temperature,
        reason: 'All monitored parameters are within acceptable limits.',
        suggestion: 'Continue routine monitoring.'
      };
    }
    const worst = results.reduce((a, b) => (this.rank(b.severity) > this.rank(a.severity) ? b : a));
    return worst;
  }

  private rank(severity: 'normal' | 'warning' | 'critical'): number {
    return { normal: 0, warning: 1, critical: 2 }[severity];
  }
  private detectParameter(
    current: number,
    reading: ISensorReading,
    history: ISensorReading[],
    key: ParameterKey,
    th: ThresholdParam
  ): AnomalyResult {
    const label = PARAM_LABELS[key];
    const reasons: string[] = [];
    const level = classifyValue(th, current);
    if (level === 'critical') {
      reasons.push(`${label} (${current.toFixed(1)} ${th.unit}) is in the critical band.`);
    } else if (level === 'warning') {
      reasons.push(`${label} (${current.toFixed(1)} ${th.unit}) is in the warning band.`);
    }

    const recent = history.slice(-8).map((r) => r[key]);
    const baseline = recent.length >= 4 ? median(recent) : current;
    if (recent.length >= 4 && isSpike(current, baseline, key)) {
      const direction = current >= baseline ? 'above' : 'below';
      const jump = Math.abs(current - baseline).toFixed(1);
      reasons.push(
        `${label} suddenly ${direction} the recent baseline by ${jump} ${th.unit} (baseline ${baseline.toFixed(1)} ${th.unit}).`
      );
    }

    const nonNormal = recent.filter((r) => classifyValue(th, r) !== 'normal').length;
    if (nonNormal >= Math.min(SUSTAINED_MIN, recent.length)) {
      reasons.push(`${label} has stayed outside the normal range for the last ${nonNormal} samples.`);
    }

    const timestamps = recent.map((_, i) => String(i * 3600));
    const trend = this.computeTrend(recent, timestamps);
    if (trend.direction === 'increasing' && trend.slope > 0.05) {
      const critMin = th.bands.critical.find((e) => e.min !== null)?.min ?? null;
      const warnMax = th.bands.warning.find((e) => e.max !== null)?.max ?? null;
      if (critMin !== null && current >= critMin) {
        reasons.push(`${label} trend is increasing and is already at the critical bound.`);
      } else if (warnMax !== null && current >= warnMax * 0.85) {
        reasons.push(`${label} trend is increasing and on course to exceed the warning bound.`);
      }
    }

    if (reasons.length === 0) {
      return {
        anomaly: false,
        severity: 'normal',
        parameter: key,
        parameterLabel: label,
        reason: 'All monitored parameters are within acceptable limits.',
        suggestion: 'Continue routine monitoring.'
      };
    }

    const severity = reasons.some((r) => r.includes('critical')) ? 'critical' : 'warning';
    return {
      anomaly: true,
      severity,
      parameter: key,
      parameterLabel: label,
      reason: reasons.join(' '),
      suggestion: SUGGESTIONS[key]
    };
  }

  private computeTrend(values: number[], timestamps: string[]): { direction: string; slope: number } {
    if (values.length < 2) return { direction: 'stable', slope: 0 };
    const times = timestamps.map((t) => new Date(t).getTime() / 1000);
    const meanX = times.reduce((a, b) => a + b, 0) / times.length;
    const meanY = values.reduce((a, b) => a + b, 0) / values.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < times.length; i++) {
      num += (times[i] - meanX) * (values[i] - meanY);
      den += (times[i] - meanX) * (times[i] - meanX);
    }
    const slope = den === 0 ? 0 : num / den;
    return { direction: slope * 3600 > 0.05 ? 'increasing' : slope * 3600 < -0.05 ? 'decreasing' : 'stable', slope: slope * 3600 };
  }
}