import { Equipment, SensorReading, ProcessingResult, TriggeredRule, MaintenanceNeed, Recommendation, DataSource, ParameterKey } from '../types';
import { PARAM_META, PARAM_ORDER, conditionHex } from '../utils/params';
import { store } from './store';

type NeedKey = MaintenanceNeed['level'];

const ACTION_BY_PARAM: Record<ParameterKey, string> = {
  temperature: 'Inspect the motor cooling system, clean ventilation and check bearing friction for overheating.',
  vibration: 'Inspect motor bearings, couplings and rotor balance.',
  voltage: 'Verify incoming supply voltage and motor protection / connection settings.',
  current: 'Check for mechanical overload, starter/contactor health and motor winding condition.'
};

const PROBLEM_BY_PARAM: Record<ParameterKey, string> = {
  temperature: 'Inadequate cooling, ambient heat or bearing friction overload.',
  vibration: 'Bearing wear, unbalance or coupling damage.',
  voltage: 'Unstable supply, poor connections or phase imbalance.',
  current: 'Mechanical load increase, winding fault or starter deterioration.'
};

const INSPECT_BY_PARAM: Record<ParameterKey, string> = {
  temperature: 'Measure winding temperature and verify cooling airflow.',
  vibration: 'Perform vibration analysis and inspect bearing clearances.',
  voltage: 'Measure line voltage under load and check connections.',
  current: 'Measure running current and compare with the rated value.'
};

function scheduleFor(priority: string): string {
  switch (priority) {
    case 'IMMEDIATE': return 'Within 24 hours';
    case 'HIGH': return 'Within 48–72 hours';
    case 'MEDIUM': return 'Within 7 days';
    default: return 'Within 30 days / next routine window';
  }
}

function uid(): string {
  return 'reco-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function generateRecommendation(
  eq: Equipment,
  pr: ProcessingResult,
  need: MaintenanceNeed,
  triggered: TriggeredRule[],
  source: DataSource
): Recommendation {
  const affected = PARAM_ORDER.filter((k) => pr.params[k].level !== 'normal');
  const primary = affected[0];

  // Prefer the strongest triggered rule recommendation; otherwise fall back to affected params.
  let action = '';
  if (triggered.length > 0) {
    action = triggered[0].recommendation;
  } else if (primary) {
    action = ACTION_BY_PARAM[primary];
  } else {
    action = 'Continue routine condition monitoring of the motor.';
  }

  let problem = 'No obvious fault detected; routine monitoring recommended.';
  if (affected.length > 0) {
    problem = affected.map((k) => PROBLEM_BY_PARAM[k]).join(' ');
  }
  let inspection = 'Perform a scheduled inspection and record sensor baselines.';
  if (affected.length > 0) {
    inspection = affected.map((k) => INSPECT_BY_PARAM[k]).join(' ');
  }

  const reasonLines = [need.reason];
  if (affected.length > 0) {
    reasonLines.push(`Affected parameter(s): ${affected.map((k) => PARAM_META[k].label).join(', ')}.`);
  }

  return {
    id: uid(),
    equipmentId: eq.equipmentId,
    equipmentName: eq.name,
    date: new Date().toISOString(),
    condition: pr.overall,
    maintenanceNeed: need.label,
    priority: need.priority,
    recommendedAction: action,
    suggestedSchedule: scheduleFor(need.priority),
    reason: reasonLines.join(' '),
    affectedParameters: affected.map((k) => PARAM_META[k].label),
    possibleProblem: problem,
    suggestedInspection: inspection,
    decision: 'pending',
    source,
    triggeredRules: triggered
  };
}

export function saveRecommendation(rec: Recommendation): void {
  store.update((s) => ({ ...s, recommendations: [rec, ...s.recommendations] }));
}

export function listRecommendations(): Recommendation[] {
  return [...store.get().recommendations].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getRecommendation(id: string): Recommendation | undefined {
  return store.get().recommendations.find((r) => r.id === id);
}

export function updateRecommendation(id: string, patch: Partial<Recommendation>): void {
  store.update((s) => ({
    ...s,
    recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, ...patch } : r))
  }));
}

export function requireNewRecommendation(eq: Equipment): boolean {
  const recs = store.get().recommendations.filter((r) => r.equipmentId === eq.equipmentId);
  if (recs.length === 0) return true;
  const recent = recs.find((r) => r.decision === 'pending');
  return !recent;
}