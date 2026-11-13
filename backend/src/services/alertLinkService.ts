/**
 * Links anomaly alerts into the existing case/failure/maintenance data model.
 *
 * When the anomaly pipeline creates an Alert, this service auto-generates a
 * MaintenanceCase (and, for critical severity, a FailureRecord) whose text is
 * pre-filled with the recommendation, then writes the new ObjectIds back onto
 * the alert via the optional forward-link fields added in step 3.
 *
 * This reuses the REAL models (MaintenanceCase, FailureRecord, MaintenanceRecord,
 * buildCaseNumber, resolveMachine, ensureDefaultUser) — it does not introduce a
 * parallel structure.
 */

import { Types } from 'mongoose';
import { Alert } from '../models/Alert';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { FailureRecord, FailureSeverity } from '../models/FailureRecord';
import { buildCaseNumber, resolveMachine } from '../utils/helpers';
import { ensureDefaultUser } from '../config/seed';

export interface AlertLinkInput {
  machineId: string;
  severity: 'normal' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  triggeredAt: number; // epoch ms
  symptom?: string;
}

export interface AlertLinkResult {
  maintenanceCaseId: Types.ObjectId | null;
  failureRecordId: Types.ObjectId | null;
}

function severityToFailureSeverity(severity: AlertLinkInput['severity']): FailureSeverity {
  if (severity === 'critical') return 'major';
  if (severity === 'warning') return 'moderate';
  return 'minor';
}

function severityToUrgency(severity: AlertLinkInput['severity']): 'low' | 'medium' | 'high' {
  if (severity === 'critical') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
}

export async function linkAlertToCases(input: AlertLinkInput): Promise<AlertLinkResult> {
  const reportedAt = new Date(input.triggeredAt);
  const machineDoc = await resolveMachine(input.machineId);
  const userId = new Types.ObjectId(await ensureDefaultUser());

  // 1. Maintenance case with the recommendation pre-filled.
  const total = await MaintenanceCase.countDocuments({});
  const maintenanceCase = await MaintenanceCase.create({
    caseNumber: buildCaseNumber(total + 1),
    machine: machineDoc._id,
    dateReported: reportedAt,
    reportedBy: userId,
    currentProblem: input.message,
    symptoms: input.symptom ? [input.symptom, input.recommendation] : [input.recommendation],
    operatingHoursAtReport: machineDoc.operatingHours ?? null,
    lastMaintenanceDate: machineDoc.lastMaintenanceDate ?? null,
    urgency: severityToUrgency(input.severity),
    status: 'draft',
    analysis: {
      generatedAt: null,
      sufficientData: false,
      message: input.recommendation,
      missingData: [],
      dataUsed: [],
      statistics: null,
      suggestions: [],
    },
    review: {
      decision: null,
      modifiedSuggestion: '',
      reviewerNote: '',
      reviewedBy: null,
      reviewedAt: null,
    },
    actualAction: {
      performedOn: null,
      actionTaken: '',
      partsReplaced: [],
      downtimeHours: null,
      technician: '',
      notes: '',
    },
    outcome: {
      result: null,
      productionLossUnits: null,
      cost: null,
      notes: '',
      recordedAt: null,
    },
    linkedMaintenanceRecord: null,
  });

  // 2. Failure record for the physical-failure-oriented severities.
  let failureRecordId: Types.ObjectId | null = null;
  if (input.severity !== 'normal') {
    const failure = await FailureRecord.create({
      machine: machineDoc._id,
      date: reportedAt,
      failureMode: input.message,
      cause: '',
      symptoms: input.symptom ? [input.symptom] : [input.message],
      severity: severityToFailureSeverity(input.severity),
      downtimeHours: 0,
      correctiveAction: input.recommendation,
      notes: 'Auto-generated from anomaly alert.',
      createdBy: userId,
    });
    failureRecordId = failure._id;
  }

  return {
    maintenanceCaseId: maintenanceCase._id,
    failureRecordId,
  };
}

/** Write the auto-created case/failure ids back onto an alert document. */
export async function attachLinksToAlert(
  alertId: Types.ObjectId,
  links: AlertLinkResult
): Promise<void> {
  await Alert.updateOne(
    { _id: alertId },
    {
      $set: {
        linkedMaintenanceCase: links.maintenanceCaseId,
        linkedFailureRecord: links.failureRecordId,
      },
    }
  );
}