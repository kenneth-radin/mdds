// Domain types for the Predictive Maintenance System.
// The UI only knows these types; concrete data comes from the services layer so
// the simulated data can later be replaced by real IoT sensor input.

export type ParameterKey = 'temperature' | 'vibration' | 'voltage' | 'current';
export type Level = 'normal' | 'warning' | 'critical';
export type Condition = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
export type DataSource = 'simulated' | 'live';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Edge { min: number | null; max: number | null; }
export interface Bands { normal: Edge[]; warning: Edge[]; critical: Edge[]; }

// For motor current, edges are multiples of the rated current so the same rule
// set works for any motor rating (never hard-coded).
export interface ParameterThreshold {
  unit: string;
  bands: Bands;
  relative: boolean;
  note?: string;
}

export interface ThresholdConfig {
  temperature: ParameterThreshold;
  vibration: ParameterThreshold;
  voltage: ParameterThreshold;
  current: ParameterThreshold;
}

export interface EquipmentSpec {
  bearings: string;
  cooling: string;
  driveType: string;
  enclosure: string;
  notes: string;
}

export interface Equipment {
  id: string;
  equipmentId: string;
  name: string;
  type: string;
  equipmentType: string;
  manufacturer: string;
  model: string;
  ratedVoltage: number;
  ratedCurrent: number;
  ratedPowerKw: number;
  operatingHours: number;
  installDate: string;
  location: string;
  status: Condition;
  lastMaintenanceDate: string | null;
  specs: EquipmentSpec;
  thresholds: ThresholdConfig;
  monitoringEnabled: boolean;
}

export interface SensorReading {
  id: string;
  equipmentId: string;
  timestamp: string;
  temperature: number;
  vibration: number;
  voltage: number;
  current: number;
  operatingHours: number;
  observation: string;
  source: DataSource;
  status?: Condition;
}

export interface ParamResult {
  key: ParameterKey;
  value: number;
  unit: string;
  level: Level;
  status: Condition;
  thresholdNote: string;
}

export interface TrendInfo {
  direction: TrendDirection;
  slope: number;
  pcChange: number;
  text: string;
}

export interface ProcessingResult {
  equipmentId: string;
  reading: SensorReading;
  params: Record<ParameterKey, ParamResult>;
  overall: Condition;
  reasons: string[];
  trends: Record<ParameterKey, TrendInfo>;
  validations: string[];
  warnings: string[];
}
export type RuleCond =
  | { op: 'level'; parameter: ParameterKey; level: Level }
  | { op: 'compare'; parameter: ParameterKey; comparator: '<' | '>' | '<=' | '>='; value: number }
  | { op: 'trend'; parameter: ParameterKey; direction: TrendDirection }
  | { op: 'and' | 'or'; operands: RuleCond[] }
  | { op: 'always' };

export interface DecisionRule {
  id: string;
  name: string;
  description: string;
  parameter: ParameterKey | 'multiple';
  condition: RuleCond;
  severity: Severity;
  scope: string;
  recommendation: string;
  enabled: boolean;
  editable: boolean;
}

export interface TriggeredRule {
  ruleId: string;
  name: string;
  severity: Severity;
  recommendation: string;
  explanation: string;
}

export type MaintenanceNeedLevel = 'none' | 'routine' | 'preventive' | 'immediate' | 'urgent';

export interface MaintenanceNeed {
  level: MaintenanceNeedLevel;
  label: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
  reason: string;
}

export interface Recommendation {
  id: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  condition: Condition;
  maintenanceNeed: string;
  priority: string;
  recommendedAction: string;
  suggestedSchedule: string;
  reason: string;
  affectedParameters: string[];
  possibleProblem: string;
  suggestedInspection: string;
  decision: 'pending' | 'accepted' | 'modified' | 'rejected' | null;
  modifiedRecommendation?: string;
  modifiedReason?: string;
  modifiedSchedule?: string;
  modifiedPriority?: string;
  reviewNote?: string;
  source: DataSource;
  triggeredRules: TriggeredRule[];
}

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  date: string;
  maintenanceType: string;
  problem: string;
  action: string;
  partsReplaced: string;
  technician: string;
  startTime: string;
  endTime: string;
  downtimeHours: number;
  notes: string;
  status: string;
  result: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'technician' | 'viewer';
  title: string;
}

export interface RiskScore { parameter: ParameterKey; riskPercent: number; level: Level; }
export interface ConditionScore {
  score: number;
  risks: RiskScore[];
  overall: Condition;
  label: string;
}

export interface Prediction {
  id: string;
  equipmentId: string;
  date: string;
  category: 'normal' | 'advisory' | 'maintenance-due' | 'urgent';
  text: string;
  detail: string[];
  daysEstimate: number | null;
}

export interface SimulationConfig {
  enabled: boolean;
  intervalSeconds: number;
  jitter: number;
  speed: number;
}

export interface AppState {
  equipment: Equipment[];
  readings: SensorReading[];
  maintenance: MaintenanceRecord[];
  rules: DecisionRule[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  users: User[];
  simulation: SimulationConfig;
  version: number;
}
