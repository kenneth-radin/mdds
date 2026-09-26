import { IMachine } from '../models/Machine';
import { IAnalysisSuggestion, IHistoryStatistics } from '../models/MaintenanceCase';
import { MachineHistory, computeStatistics } from './historyService';
import { ComparableCase, SIMILARITY_METHOD, findComparableCases } from './comparableCaseService';
import { round } from '../utils/helpers';

export const MIN_COMPARABLE_RECORDS = 3;

export interface AnalysisInput {
  currentProblem: string;
  symptoms: string[];
  operatingHoursAtReport: number | null;
  lastMaintenanceDate: Date | null;
  hoursSinceLastMaintenance: number | null;
  urgency: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  generatedAt: Date;
  sufficientData: boolean;
  message: string;
  missingData: string[];
  dataUsed: string[];
  statistics: IHistoryStatistics;
  suggestions: IAnalysisSuggestion[];
  comparableRecords: ComparableCase[];
}

function buildMissingData(history: MachineHistory, comparable: ComparableCase[]): string[] {
  const missing: string[] = [];
  if (history.maintenanceRecords.length === 0) missing.push('No maintenance history available for this machine.');
  if (history.failureRecords.length === 0) missing.push('No failure records available for this machine.');
  if (history.completedCases.length === 0) missing.push('No completed maintenance cases available for this machine.');
  if (comparable.length < MIN_COMPARABLE_RECORDS) {
    missing.push(
      `Only ${comparable.length} comparable historical record(s) found; at least ${MIN_COMPARABLE_RECORDS} are required.`
    );
  }
  return missing;
}

function groupComparable(records: ComparableCase[]): IAnalysisSuggestion[] {
  const groups = new Map<string, ComparableCase[]>();
  records.forEach((record) => {
    const action = (record.action || record.problem || '').trim();
    if (!action) return;
    const key = action.toLowerCase();
    groups.set(key, [...(groups.get(key) || []), record]);
  });

  const suggestions: IAnalysisSuggestion[] = [];
  groups.forEach((group) => {
    const sample = group[0];
    const supportCount = group.length;
    const parts = [...new Set(group.flatMap((g) => g.parts).filter(Boolean))];
    const downtimeValues = group
      .map((g) => g.downtimeHours)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const expectedDowntimeHours =
      downtimeValues.length > 0 ? round(downtimeValues.reduce((a, b) => a + b, 0) / downtimeValues.length, 2) : null;
    const avgSimilarity = round(group.reduce((a, b) => a + b.similarity, 0) / group.length, 2);

    // Confidence is derived purely from real evidence: how many comparable records
    // support this action, overall record volume, and how closely they match.
    const supportRatio = supportCount / records.length;
    const volumeFactor = Math.min(1, records.length / (MIN_COMPARABLE_RECORDS * 2));
    const confidence = Math.max(1, Math.min(95, Math.round(supportRatio * avgSimilarity * 100 * (0.5 + volumeFactor))));

    const failureModes = [...new Set(group.map((g) => g.failureMode).filter(Boolean))];
    const rationaleParts = [
      `${supportCount} comparable historical record(s) used this action (average similarity ${avgSimilarity}).`
    ];
    if (failureModes.length > 0) rationaleParts.push(`Related recorded failure mode(s): ${failureModes.join(', ')}.`);
    if (expectedDowntimeHours !== null) rationaleParts.push(`Average recorded downtime: ${expectedDowntimeHours} hour(s).`);

    suggestions.push({
      title: sample.action.length > 120 ? `${sample.action.slice(0, 117)}...` : sample.action,
      rationale: rationaleParts.join(' '),
      recommendedAction: sample.action,
      parts,
      expectedDowntimeHours,
      supportCount,
      sourceRecordIds: group.map((g) => g.sourceId),
      confidence
    });
  });

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

export function analyzeMaintenanceCase(
  machine: IMachine,
  history: MachineHistory,
  input: AnalysisInput
): AnalysisResult {
  const comparable = findComparableCases(history, input.currentProblem, input.symptoms);
  const statistics = computeStatistics(history);
  statistics.comparableCases = comparable.length;

  const missingData = buildMissingData(history, comparable);
  const sufficientData = comparable.length >= MIN_COMPARABLE_RECORDS;

  const dataUsed = [
    `${history.maintenanceRecords.length} maintenance record(s)`,
    `${history.failureRecords.length} failure record(s)`,
    `${history.operationalRecords.length} operational data record(s)`,
    `${history.completedCases.length} completed case(s)`,
    `${comparable.length} comparable record(s)`,
    `similarity method: ${SIMILARITY_METHOD}`,
    `machine profile: ${machine.machineId} / ${machine.machineType}`
  ];

  if (!sufficientData) {
    return {
      generatedAt: new Date(),
      sufficientData: false,
      message: 'Insufficient historical data for reliable analysis.',
      missingData,
      dataUsed,
      statistics,
      suggestions: [],
      comparableRecords: comparable
    };
  }

  const suggestions = groupComparable(comparable);
  return {
    generatedAt: new Date(),
    sufficientData: suggestions.length > 0,
    message:
      suggestions.length > 0
        ? `${suggestions.length} suggestion(s) derived from ${comparable.length} comparable historical record(s).`
        : 'Insufficient historical data for reliable analysis.',
    missingData: suggestions.length > 0 ? [] : missingData,
    dataUsed,
    statistics,
    suggestions,
    comparableRecords: comparable
  };
}
