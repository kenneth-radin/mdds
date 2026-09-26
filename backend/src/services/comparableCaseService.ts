import { IMachine } from '../models/Machine';
import { MachineHistory } from './historyService';
import { round } from '../utils/helpers';
import { buildCorpus, rankCorpus } from './ml/tfidf';

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

/**
 * Layer 1 similarity. Declared as an exported constant so the analysis response
 * can state which retrieval method produced its evidence.
 */
export const SIMILARITY_METHOD = 'TF-IDF weighted cosine similarity (Layer 1)';

/** A historical record plus the exact text field that gets vectorised. */
interface Candidate {
  sourceType: ComparableSource;
  sourceId: string;
  date: string;
  problem: string;
  action: string;
  parts: string[];
  downtimeHours: number | null;
  failureMode: string | null;
  text: string;
}

function toIsoDate(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function optionalHours(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : null;
}

/**
 * Collects every historical record that could serve as evidence.
 * The document text per source type is unchanged from the previous
 * implementation — only the similarity metric that compares them has changed,
 * so the evidence set itself did not silently shift underneath the change.
 */
function buildCandidates(history: MachineHistory): Candidate[] {
  const candidates: Candidate[] = [];

  for (const record of history.maintenanceRecords as Array<Record<string, any>>) {
    const problem = String(record.problem || '');
    const action = String(record.action || '');
    candidates.push({
      sourceType: 'maintenance-record',
      sourceId: String(record._id),
      date: toIsoDate(record.date),
      problem,
      action,
      parts: (record.partsReplaced as string[]) || [],
      downtimeHours: optionalHours(record.downtimeHours),
      failureMode: null,
      text: `${problem} ${action} ${record.maintenanceType || ''}`
    });
  }

  for (const record of history.failureRecords as Array<Record<string, any>>) {
    const symptomsText = ((record.symptoms as string[]) || []).join(' ');
    candidates.push({
      sourceType: 'failure-record',
      sourceId: String(record._id),
      date: toIsoDate(record.date),
      problem: String(record.failureMode || ''),
      action: String(record.correctiveAction || ''),
      parts: [],
      downtimeHours: optionalHours(record.downtimeHours),
      failureMode: String(record.failureMode || '') || null,
      text: `${record.failureMode || ''} ${symptomsText}`
    });
  }

  for (const record of history.completedCases as Array<Record<string, any>>) {
    const symptomsText = ((record.symptoms as string[]) || []).join(' ');
    const action = record.actualAction?.actionTaken || record.review?.modifiedSuggestion || '';
    candidates.push({
      sourceType: 'completed-case',
      sourceId: String(record._id),
      date: toIsoDate(record.dateReported),
      problem: String(record.currentProblem || ''),
      action: String(action),
      parts: (record.actualAction?.partsReplaced as string[]) || [],
      downtimeHours: optionalHours(record.actualAction?.downtimeHours),
      failureMode: null,
      text: `${record.currentProblem || ''} ${symptomsText}`
    });
  }

  return candidates;
}

/**
 * Ranks real historical records against the reported problem using TF-IDF
 * cosine similarity over the machine's own history.
 *
 * Nothing is randomised and nothing is invented: a record appears in the result
 * only because it shares discriminative vocabulary with the current problem.
 */
export function findComparableCases(
  history: MachineHistory,
  problemText: string,
  symptoms: string[]
): ComparableCase[] {
  const candidates = buildCandidates(history);
  if (candidates.length === 0) return [];

  // The corpus is this machine's history, so idf reflects what is distinctive
  // within the machine's own record set rather than a generic English corpus.
  const corpus = buildCorpus(candidates.map((candidate) => candidate.text));
  const query = [problemText, ...symptoms].filter(Boolean).join(' ');
  if (!query.trim()) return [];

  // minSimilarity 0 keeps every record with any shared discriminant; the
  // MIN_COMPARABLE_RECORDS gate in analysisService decides whether that is enough.
  return rankCorpus(corpus, query, { minSimilarity: 0 }).map((match) => {
    const candidate = candidates[match.index];
    return {
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      date: candidate.date,
      problem: candidate.problem,
      action: candidate.action,
      parts: candidate.parts,
      downtimeHours: candidate.downtimeHours,
      failureMode: candidate.failureMode,
      similarity: round(match.similarity, 3)
    };
  });
}

export function describeMachineType(machine: IMachine): string {
  return [machine.machineType, machine.manufacturer, machine.model].filter(Boolean).join(' ');
}
