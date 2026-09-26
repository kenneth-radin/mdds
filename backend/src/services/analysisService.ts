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
  if (history.maintenanceRecords.length === 0) missing.push('No past maintenance records found for this machine.');
  if (history.failureRecords.length === 0) missing.push('No past failure records found for this machine.');
  if (history.completedCases.length === 0) missing.push('No resolved maintenance cases found for this machine.');
  if (comparable.length < MIN_COMPARABLE_RECORDS) {
    missing.push(
      `Found ${comparable.length} similar past record(s); at least ${MIN_COMPARABLE_RECORDS} are needed for a recommendation.`
    );
  }
  return missing;
}

function formatEvidenceLine(record: ComparableCase): string {
  const typeLabel =
    record.sourceType === 'maintenance-record'
      ? 'past maintenance'
      : record.sourceType === 'failure-record'
      ? 'past failure'
      : 'resolved case';
  const dateStr = record.date
    ? new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const actionOrProblem = (record.action || record.problem || 'Maintenance recorded').trim();
  const shortSummary = actionOrProblem.length > 60 ? actionOrProblem.slice(0, 57) + '...' : actionOrProblem;
  const matchPct = Math.round(record.similarity * 100);
  const meta = [typeLabel];
  if (dateStr) meta.push(dateStr);
  if (matchPct > 0) meta.push(String(matchPct) + '% text match');
  return '"' + shortSummary + '" (' + meta.join(' · ') + ')';
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
    const matchPct = Math.round(avgSimilarity * 100);
    const rationaleParts = [
      `Used in ${supportCount} of ${records.length} similar past records (${matchPct}% average text match).`
    ];
    if (failureModes.length > 0) rationaleParts.push(`Linked to past failure mode(s): ${failureModes.join(', ')}.`);
    if (expectedDowntimeHours !== null) rationaleParts.push(`Average recorded downtime: ${expectedDowntimeHours} hr(s).`);

    suggestions.push({
      title: sample.action.length > 120 ? `${sample.action.slice(0, 117)}...` : sample.action,
      rationale: rationaleParts.join(' '),
      recommendedAction: sample.action,
      parts,
      expectedDowntimeHours,
      supportCount,
      sourceRecordIds: group.map((g) => g.sourceId),
      evidence: [...group]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 4)
        .map(formatEvidenceLine),
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
    `${history.maintenanceRecords.length} past maintenance record(s)`,
    `${history.failureRecords.length} past failure record(s)`,
    `${history.operationalRecords.length} operational log(s)`,
    `${history.completedCases.length} resolved case(s)`,
    `${comparable.length} similar record(s) matched`,
    `similarity method: ${SIMILARITY_METHOD}`,
    `machine profile: ${machine.machineId} (${machine.machineType})`
  ];

  if (!sufficientData) {
    return {
      generatedAt: new Date(),
      sufficientData: false,
      message: 'Not enough similar past records to suggest a solution yet.',
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
        ? `Found ${suggestions.length} suggestion(s) based on ${comparable.length} similar past record(s).`
        : 'Not enough similar past records to suggest a solution yet.',
    missingData: suggestions.length > 0 ? [] : missingData,
    dataUsed,
    statistics,
    suggestions,
    comparableRecords: comparable
  };
}
