import { Equipment, ProcessingResult, MaintenanceNeed, Prediction, ConditionScore, ParameterKey } from '../types';
import { computeScore } from '../utils/score';
import { PARAM_META, PARAM_ORDER } from '../utils/params';
import { resolveThresholds } from '../utils/calc';
import { hoursToThreshold } from './processingService';

export function scoreCondition(eq: Equipment, pr: ProcessingResult): ConditionScore {
  return computeScore(pr.params, resolveThresholds(eq));
}

function uid(): string {
  return 'rec-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function generatePrediction(eq: Equipment, pr: ProcessingResult, need: MaintenanceNeed, score: ConditionScore): Prediction {
  const critical = PARAM_ORDER.filter((k) => pr.params[k].level === 'critical');
  const warning = PARAM_ORDER.filter((k) => pr.params[k].level === 'warning');
  const rise = PARAM_ORDER.filter((k) => pr.trends[k].direction === 'increasing');
  const bad = critical.map((k) => PARAM_META[k].label).join(', ');
  let category: Prediction['category'];
  let text: string;
  let daysEstimate: number | null;

  if (pr.overall === 'CRITICAL') {
    category = 'urgent';
    text = `Immediate inspection recommended due to critical ${bad || 'readings'}.`;
    daysEstimate = 0;
  } else if (need.level === 'immediate' || need.level === 'urgent') {
    category = 'urgent';
    text = 'Immediate inspection recommended because several parameters are abnormal.';
    daysEstimate = 1;
  } else if (need.level === 'preventive') {
    category = 'maintenance-due';
    daysEstimate = estimateDays(eq, pr, warning);
    text = `Maintenance may be required within the next ${daysEstimate ? `~${daysEstimate}` : ''} days. ${warning.map((k) => PARAM_META[k].label).join(', ')} readings are rising.`;
  } else if (warning.length > 0 || rise.length > 0) {
    category = 'advisory';
    daysEstimate = estimateDays(eq, pr, rise);
    text = 'Trends indicate increasing motor stress. Continue monitoring and plan an inspection before thresholds are reached.';
  } else {
    category = 'normal';
    daysEstimate = null;
    text = 'Equipment is operating within normal limits. Continue routine monitoring.';
  }

  const detail: string[] = [];
  for (const k of PARAM_ORDER) {
    const r = score.risks.find((x) => x.parameter === k);
    detail.push(`${PARAM_META[k].label} risk ${r ? Math.round(r.riskPercent) : 0}%, trend ${pr.trends[k].direction}.`);
  }
  detail.push(`Condition score ${score.score}/100 (${score.label}).`);

  return {
    id: uid(),
    equipmentId: eq.equipmentId,
    date: new Date().toISOString(),
    category,
    text,
    detail,
    daysEstimate
  };
}

function estimateDays(eq: Equipment, pr: ProcessingResult, keys: ParameterKey[]): number | null {
  const hours: number[] = [];
  for (const k of keys) {
    const h = hoursToThreshold(eq, pr, k);
    if (h !== null && h >= 0) hours.push(h);
  }
  if (hours.length === 0) return null;
  return Math.max(1, Math.ceil(Math.min(...hours) / 24));
}