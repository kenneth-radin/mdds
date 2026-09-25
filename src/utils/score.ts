import { Condition, ConditionScore, Level, ParameterKey, ParamResult, RiskScore, ThresholdConfig, ParameterThreshold } from '../types';
import { PARAM_ORDER, levelLabel } from './params';

const WEIGHTS: Record<ParameterKey, number> = {
  temperature: 0.3,
  vibration: 0.25,
  voltage: 0.2,
  current: 0.25
};

// Risk 0..100. 100 when the value is at/inside a critical band; otherwise the
// fraction of the way from the nearest normal bound to the critical bound.
export function riskPercent(th: ParameterThreshold, value: number): number {
  let normMin = Infinity;
  let normMax = -Infinity;
  for (const e of th.bands.normal) {
    if (e.min !== null) normMin = Math.min(normMin, e.min);
    if (e.max !== null) normMax = Math.max(normMax, e.max);
  }
  if (!isFinite(normMin)) normMin = -1e9;
  if (!isFinite(normMax)) normMax = 1e9;
  let best = 0;
  for (const ce of th.bands.critical) {
    const highSide = ce.min !== null;      // approaching from the high side
    const inner = highSide ? ce.min : ce.max;
    if (inner === null) continue;
    const safe = highSide ? normMax : normMin;
    if (Math.abs(inner - safe) < 1e-9) continue;
    const done = Math.abs(value - safe);
    const total = Math.abs(inner - safe);
    best = Math.max(best, total > 0 ? done / total : 0);
  }
  if (best >= 1) return 100;
  return Math.max(0, Math.min(best, 1) * 100);
}

function isFinite(n: number): boolean {
  return Number.isFinite(n);
}

export function worstCondition(levels: Level[]): Condition {
  if (levels.some((l) => l === 'critical')) return 'CRITICAL';
  if (levels.some((l) => l === 'warning')) return 'WARNING';
  return 'NORMAL';
}

export function symptomLevels(params: Record<ParameterKey, ParamResult>): Level[] {
  return PARAM_ORDER.map((k) => params[k].level);
}

export function computeScore(params: Record<ParameterKey, ParamResult>, thresholds: ThresholdConfig): ConditionScore {
  const risks: RiskScore[] = PARAM_ORDER.map((key) => {
    const th = thresholds[key];
    const r = riskPercent(th, params[key].value);
    return { parameter: key, riskPercent: Math.round(r * 10) / 10, level: params[key].level };
  });
  let score = 100.0;
  for (const r of risks) {
    score -= WEIGHTS[r.parameter] * r.riskPercent;
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const overall = worstCondition(risks.map((r) => r.level));
  let label: string;
  if (finalScore >= 90) label = 'Excellent';
  else if (finalScore >= 75) label = 'Good';
  else if (finalScore >= 50) label = 'Fair';
  else if (finalScore >= 30) label = 'Poor';
  else label = 'Critical';
  return { score: finalScore, risks, overall, label };
}

export function riskLabel(level: Level): string {
  return levelLabel(level);
}