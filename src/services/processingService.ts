import { Equipment, SensorReading, ProcessingResult, ParamResult, Condition, Level, ParameterKey, TrendInfo } from '../types';
import { PARAM_META, PARAM_ORDER } from '../utils/params';
import { resolveThresholds, classifyValue, bandNote } from '../utils/calc';
import { computeTrend, forecastLinear } from '../utils/trend';
import { worstCondition } from '../utils/score';

function toCondition(l: Level): Condition {
  return l === 'critical' ? 'CRITICAL' : l === 'warning' ? 'WARNING' : 'NORMAL';
}

export function validateReading(reading: SensorReading): string[] {
  const warnings: string[] = [];
  const finite = (v: number): boolean => Number.isFinite(v);
  if (!finite(reading.temperature) || reading.temperature < -40 || reading.temperature > 250) warnings.push('Temperature reading is out of the physical range.');
  if (!finite(reading.vibration) || reading.vibration < 0 || reading.vibration > 100) warnings.push('Vibration reading is out of range.');
  if (!finite(reading.voltage) || reading.voltage < 0 || reading.voltage > 1000) warnings.push('Voltage reading is out of range.');
  if (!finite(reading.current) || reading.current < 0 || reading.current > 1000) warnings.push('Motor current reading is out of range.');
  if (!reading.timestamp) warnings.push('Timestamp is missing.');
  if (warnings.length === 0) warnings.push('All sensor readings passed validation.');
  return warnings;
}

export function processReading(eq: Equipment, reading: SensorReading, history: SensorReading[]): ProcessingResult {
  const th = resolveThresholds(eq);
  const params: Record<ParameterKey, ParamResult> = {} as Record<ParameterKey, ParamResult>;
  for (const key of PARAM_ORDER) {
    const pth = th[key];
    const val = reading[key];
    const level = classifyValue(pth, val);
    params[key] = {
      key,
      value: val,
      unit: pth.unit,
      level,
      status: toCondition(level),
      thresholdNote: bandNote(pth, val, level)
    };
  }

  // Build the time series including current reading.
  const series = [...history, reading].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  const trends = PARAM_ORDER.reduce<Record<ParameterKey, TrendInfo>>((acc, key) => {
    acc[key] = computeTrend(series.map((r) => r[key]), series.map((r) => r.timestamp));
    return acc;
  }, {} as Record<ParameterKey, TrendInfo>);

  const levels = PARAM_ORDER.map((k) => params[k].level);
  let overall: Condition = worstCondition(levels);
  if (!eq.monitoringEnabled) overall = 'OFFLINE';

  const reasons: string[] = [];
  for (const key of PARAM_ORDER) {
    const p = params[key];
    const meta = PARAM_META[key];
    if (p.level === 'critical') reasons.push(`${meta.label} (${p.value.toFixed(1)} ${p.unit}) has reached a critical threshold.`);
    else if (p.level === 'warning') reasons.push(`${meta.label} (${p.value.toFixed(1)} ${p.unit}) is outside the normal operating range.`);
  }
  for (const key of PARAM_ORDER) {
    const t = trends[key];
    const meta = PARAM_META[key];
    if (t.direction === 'increasing') reasons.push(`${meta.label} trend is increasing and approaching the warning/critical threshold.`);
  }
  if (reasons.length === 0) reasons.push('All monitored parameters are within acceptable limits.');

  return {
    equipmentId: eq.equipmentId,
    reading,
    params,
    overall,
    reasons,
    trends,
    validations: validateReading(reading),
    warnings: []
  };
}

export function parametersIn(pr: ProcessingResult, levels: Level[]): ParameterKey[] {
  return PARAM_ORDER.filter((k) => levels.includes(pr.params[k].level));
}

export function hoursToThreshold(eq: Equipment, pr: ProcessingResult, key: ParameterKey): number | null {
  // Estimate hours before a currently-warning parameter reaches its critical bound,
  // based on the observed hourly slope.
  const t = pr.trends[key];
  if (t.direction !== 'increasing') return null;
  const th = resolveThresholds(eq);
  const critEdges = th[key].bands.critical.filter((e) => e.min !== null);
  if (critEdges.length === 0) return null;
  const critBound = Math.min(...critEdges.map((e) => e.min as number));
  const value = pr.params[key].value;
  const diff = critBound - value;
  return t.slope > 0 ? diff / t.slope : null;
}

export { forecastLinear };