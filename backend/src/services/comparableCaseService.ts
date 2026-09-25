import { IMachine } from '../models/Machine';
import { MachineHistory } from './historyService';
import { jaccard, normalizeTokens, round } from '../utils/helpers';

export type ComparableSource = 'maintenance-record' | 'failure-record' | 'completed-case';

export interface ComparableCase {
  sourceType: ComparableSource;
  sourceId: string;
  date: string;
  problem: string;
  action: string;
  parts: string[];
  downtimeHours: number | null;
  failureMode: string | null;
  similarity: number;
}

// Similarity is a deterministic token overlap between the current problem / symptoms
// and real historical records. Nothing is random and nothing is invented.
export function findComparableCases(
  history: MachineHistory,
  problemText: string,
  symptoms: string[]
): ComparableCase[] {
  const queryTokens = [...normalizeTokens(problemText), ...symptoms.flatMap((s) => normalizeTokens(s))];
  const results: ComparableCase[] = [];

  const maintenance = history.maintenanceRecords as Array<Record<string, any>>;
  for (const record of maintenance) {
    const haystack = `${record.problem || ''} ${record.action || ''} ${record.maintenanceType || ''}`;
    const similarity = jaccard(queryTokens, normalizeTokens(haystack));
    if (similarity > 0) {
      results.push({
        sourceType: 'maintenance-record',
        sourceId: String(record._id),
        date: new Date(record.date).toISOString(),
        problem: String(record.problem || ''),
        action: String(record.action || ''),
        parts: (record.partsReplaced as string[]) || [],
        downtimeHours: record.downtimeHours === undefined ? null : Number(record.downtimeHours),
        failureMode: null,
        similarity: round(similarity, 3)
      });
    }
  }

  const failures = history.failureRecords as Array<Record<string, any>>;
  for (const record of failures) {
    const symptomsText = ((record.symptoms as string[]) || []).join(' ');
    const similarity = jaccard(queryTokens, normalizeTokens(`${record.failureMode || ''} ${symptomsText}`));
    if (similarity > 0) {
      results.push({
        sourceType: 'failure-record',
        sourceId: String(record._id),
        date: new Date(record.date).toISOString(),
        problem: String(record.failureMode || ''),
        action: String(record.correctiveAction || ''),
        parts: [],
        downtimeHours: record.downtimeHours === undefined ? null : Number(record.downtimeHours),
        failureMode: String(record.failureMode || '') || null,
        similarity: round(similarity, 3)
      });
    }
  }

  const cases = history.completedCases as Array<Record<string, any>>;
  for (const record of cases) {
    const symptomsText = ((record.symptoms as string[]) || []).join(' ');
    const similarity = jaccard(queryTokens, normalizeTokens(`${record.currentProblem || ''} ${symptomsText}`));
    if (similarity > 0) {
      const action = record.actualAction?.actionTaken || record.review?.modifiedSuggestion || '';
      results.push({
        sourceType: 'completed-case',
        sourceId: String(record._id),
        date: new Date(record.dateReported).toISOString(),
        problem: String(record.currentProblem || ''),
        action: String(action),
        parts: (record.actualAction?.partsReplaced as string[]) || [],
        downtimeHours: record.actualAction?.downtimeHours ?? null,
        failureMode: null,
        similarity: round(similarity, 3)
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

export function describeMachineType(machine: IMachine): string {
  return [machine.machineType, machine.manufacturer, machine.model].filter(Boolean).join(' ');
}
