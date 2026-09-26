import { Schema, model, Document, Types } from 'mongoose';

export type CaseStatus = 'draft' | 'analyzed' | 'reviewed' | 'completed';
export type ReviewDecision = 'accepted' | 'modified' | 'rejected';
export type OutcomeResult = 'resolved' | 'partially-resolved' | 'not-resolved';

export interface IAnalysisSuggestion {
  title: string;
  rationale: string;
  recommendedAction: string;
  parts: string[];
  expectedDowntimeHours: number | null;
  supportCount: number;
  sourceRecordIds: string[];
  evidence?: string[];
  confidence: number;
}

export interface IHistoryStatistics {
  totalMaintenanceRecords: number;
  totalFailureRecords: number;
  totalOperationalRecords: number;
  totalCompletedCases: number;
  mtbfDays: number | null;
  mttrHours: number | null;
  averageMaintenanceIntervalDays: number | null;
  averageDowntimeHours: number | null;
  averageCost: number | null;
  averageProductionLossUnits: number | null;
  failureModes: Array<{ mode: string; count: number }>;
  commonParts: Array<{ part: string; count: number }>;
  commonActions: Array<{ action: string; count: number }>;
  comparableCases: number;
}

export interface IMaintenanceCase extends Document {
  _id: Types.ObjectId;
  caseNumber: string;
  machine: Types.ObjectId;
  dateReported: Date;
  reportedBy: Types.ObjectId;
  currentProblem: string;
  symptoms: string[];
  operatingHoursAtReport: number | null;
  lastMaintenanceDate: Date | null;
  hoursSinceLastMaintenance: number | null;
  urgency: 'low' | 'medium' | 'high';
  status: CaseStatus;
  analysis: {
    generatedAt: Date | null;
    sufficientData: boolean;
    message: string;
    missingData: string[];
    dataUsed: string[];
    statistics: IHistoryStatistics | null;
    suggestions: IAnalysisSuggestion[];
  };
  review: {
    decision: ReviewDecision | null;
    modifiedSuggestion: string;
    reviewerNote: string;
    reviewedBy: Types.ObjectId | null;
    reviewedAt: Date | null;
  };
  actualAction: {
    performedOn: Date | null;
    actionTaken: string;
    partsReplaced: string[];
    downtimeHours: number | null;
    technician: string;
    notes: string;
  };
  outcome: {
    result: OutcomeResult | null;
    productionLossUnits: number | null;
    cost: number | null;
    notes: string;
    recordedAt: Date | null;
  };
  linkedMaintenanceRecord: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const emptyReview = () => ({
  decision: null,
  modifiedSuggestion: '',
  reviewerNote: '',
  reviewedBy: null,
  reviewedAt: null
});

const emptyAction = () => ({
  performedOn: null,
  actionTaken: '',
  partsReplaced: [],
  downtimeHours: null,
  technician: '',
  notes: ''
});

const emptyOutcome = () => ({
  result: null,
  productionLossUnits: null,
  cost: null,
  notes: '',
  recordedAt: null
});

const maintenanceCaseSchema = new Schema<IMaintenanceCase>(
  {
    caseNumber: { type: String, required: true, unique: true, trim: true },
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    dateReported: { type: Date, default: () => new Date() },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currentProblem: { type: String, required: true, trim: true },
    symptoms: { type: [String], default: [] },
    operatingHoursAtReport: { type: Number, default: null },
    lastMaintenanceDate: { type: Date, default: null },
    hoursSinceLastMaintenance: { type: Number, default: null },
    urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['draft', 'analyzed', 'reviewed', 'completed'], default: 'draft' },
    analysis: {
      generatedAt: { type: Date, default: null },
      sufficientData: { type: Boolean, default: false },
      message: { type: String, default: '' },
      missingData: { type: [String], default: [] },
      dataUsed: { type: [String], default: [] },
      statistics: { type: Schema.Types.Mixed, default: null },
      suggestions: { type: [Schema.Types.Mixed], default: [] }
    },
    review: { type: Schema.Types.Mixed, default: emptyReview },
    actualAction: { type: Schema.Types.Mixed, default: emptyAction },
    outcome: { type: Schema.Types.Mixed, default: emptyOutcome },
    linkedMaintenanceRecord: { type: Schema.Types.ObjectId, ref: 'MaintenanceRecord', default: null }
  },
  { timestamps: true, minimize: false }
);

maintenanceCaseSchema.index({ machine: 1, dateReported: -1 });

export const MaintenanceCase = model<IMaintenanceCase>('MaintenanceCase', maintenanceCaseSchema);
