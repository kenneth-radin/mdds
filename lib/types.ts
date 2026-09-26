export type ObjectId = string;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'technician' | 'viewer';
  title: string;
}

export interface Machine {
  _id: ObjectId;
  machineId: string;
  name: string;
  machineType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  criticality: 'low' | 'medium' | 'high';
  installationDate: string | null;
  ratedPowerKw: number | null;
  ratedVoltage: number | null;
  ratedCurrent: number | null;
  designSpeedRpm: number | null;
  /** §11 — rated / design capacity, interpreted with capacityUnit. */
  ratedCapacity: number | null;
  capacityUnit: string;
  /** §11 — year acquired / put into service. */
  yearAcquired: number | null;
  operatingHours: number;
  lastMaintenanceDate: string | null;
  /** §11 — recommended maintenance interval in days. */
  recommendedMaintenanceIntervalDays: number | null;
  notes: string;
}

export interface MaintenanceRecord {
  _id: ObjectId;
  machine: ObjectId;
  date: string;
  maintenanceType: 'preventive' | 'corrective' | 'predictive' | 'inspection' | 'overhaul';
  problem: string;
  action: string;
  partsReplaced: string[];
  technician: string;
  downtimeHours: number;
  cost: number | null;
  productionLossUnits: number | null;
  energyKwh: number | null;
  result: string;
  notes: string;
}

export interface FailureRecord {
  _id: ObjectId;
  machine: ObjectId;
  date: string;
  failureMode: string;
  cause: string;
  symptoms: string[];
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  downtimeHours: number;
  correctiveAction: string;
  notes: string;
}

export interface OperationalRecord {
  _id: ObjectId;
  machine: ObjectId;
  date: string;
  operatingHours: number;
  productionOutput: number | null;
  downtimeHours: number;
  energyKwh: number | null;
  notes: string;
}

export interface AnalysisSuggestion {
  title: string;
  rationale: string;
  recommendedAction: string;
  parts: string[];
  expectedDowntimeHours: number | null;
  supportCount: number;
  sourceRecordIds: string[];
  confidence: number;
}

export interface HistoryStatistics {
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

export interface MaintenanceCase {
  _id: ObjectId;
  caseNumber: string;
  machine: Machine | ObjectId;
  currentProblem: string;
  symptoms: string[];
  operatingHoursAtReport: number | null;
  hoursSinceLastMaintenance: number | null;
  urgency: 'low' | 'medium' | 'high';
  status: 'draft' | 'analyzed' | 'reviewed' | 'completed';
  dateReported: string;
  analysis: {
    generatedAt: string | null;
    sufficientData: boolean;
    message: string;
    missingData: string[];
    dataUsed: string[];
    statistics: HistoryStatistics | null;
    suggestions: AnalysisSuggestion[];
  };
  review: {
    decision: 'accepted' | 'modified' | 'rejected' | null;
    modifiedSuggestion: string;
    reviewerNote: string;
    reviewedAt: string | null;
  };
  actualAction: {
    performedOn: string | null;
    actionTaken: string;
    partsReplaced: string[];
    downtimeHours: number | null;
    technician: string;
    notes: string;
  };
  outcome: {
    result: 'resolved' | 'partially-resolved' | 'not-resolved' | null;
    productionLossUnits: number | null;
    cost: number | null;
    notes: string;
    recordedAt: string | null;
  };
}

export interface TestingCase {
  _id: ObjectId;
  machine: Machine | ObjectId;
  description: string;
  expectedSuggestion: string;
  actualSuggestion: string;
  matched: boolean;
  matchScore: number | null;
  notes: string;
  createdAt: string;
}

export interface SummaryReport {
  generatedAt: string;
  hasData: boolean;
  message: string;
  totals: {
    machines: number;
    maintenanceRecords: number;
    failureRecords: number;
    operationalRecords: number;
    maintenanceCases: number;
    completedCases: number;
    testingCases: number;
    overallDowntimeHours: number;
  };
  machinesByCriticality: Array<{ criticality: string; count: number }>;
  maintenanceByType: Array<{ maintenanceType: string; count: number }>;
  failuresBySeverity: Array<{ severity: string; count: number }>;
  casesByStatus: Array<{ status: string; count: number }>;
  testing: { total: number; matched: number; matchRate: number | null };
  /** §46 — how personnel responded to the analysis suggestions. Buckets sum to total cases. */
  suggestionDecisions: { accepted: number; modified: number; rejected: number; notReviewed: number };
}

/** §23 — per-class precision/recall/F1, so a rare positive class cannot hide behind accuracy. */
export interface MlPerClassMetrics {
  label: string;
  support: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

/**
 * A model card. This is the part that makes the AI defensible: for every exposed
 * model it states the dataset and licence, whether the data is synthetic, how
 * evaluation was done, the full per-class metrics, the majority-class baseline it
 * had to beat, and an explicit list of limitations.
 */
export interface MlModelCard {
  id: string;
  name: string;
  description: string;
  kind: string;
  layer: number;
  status: 'trained' | 'not-trained';
  /** Why the model is unavailable; only present when status is 'not-trained'. */
  reason?: string;
  task: string;
  dataset: {
    name: string;
    source: string;
    citation: string;
    license: string;
    synthetic: boolean;
    samples: number;
    classBalance: Record<string, number>;
    note: string;
  } | null;
  features: string[];
  labels: string[];
  training: { samples: number; features: number; classes: number; epochs: number; learningRate: number; l2: number; stoppedAtEpoch: number } | null;
  evaluation: {
    method: string;
    folds: number;
    seed: number;
    accuracy: number;
    macroF1: number;
    weightedF1: number;
    majorityClassBaseline: number;
    majorityClassLabel: string;
    samples: number;
    labels: string[];
    perClass: MlPerClassMetrics[];
    confusionMatrix: number[][];
  } | null;
  limitations: string[];
  trainedAt: string | null;
}

export interface MlModelList {
  models: MlModelCard[];
  count: number;
  decisionThreshold: number;
}

/** Operating parameters accepted by the benchmark classifiers. */
export interface MlOperatingParameters {
  airTemperatureK: number;
  processTemperatureK: number;
  rotationalSpeedRpm: number;
  torqueNm: number;
  toolWearMin: number;
  productType: 'L' | 'M' | 'H';
}

export interface MlPrediction {
  modelId: string;
  name: string;
  status: 'trained' | 'not-trained';
  reason?: string;
  flagged?: boolean;
  probability?: number;
  decisionThreshold?: number;
  evaluation: {
    method: string;
    accuracy: number;
    majorityClassBaseline: number;
    macroF1: number;
    perClass: MlPerClassMetrics[];
  } | null;
}

export interface MlPredictResponse {
  analysisMethod: string;
  layer: number;
  input: MlOperatingParameters;
  /** The exact derived feature vector, so the caller can audit the computation. */
  features: Array<{ name: string; value: number }>;
  results: MlPrediction[];
  limitations: string[];
  note: string;
}
