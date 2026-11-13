import { Schema, model, Document, Types } from 'mongoose';

export type Criticality = 'low' | 'medium' | 'high';

export interface IMachine {
  _id: Types.ObjectId;
  machineId: string;
  name: string;
  machineType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  criticality: Criticality;
  installationDate?: Date | null;
  ratedPowerKw?: number | null;
  ratedVoltage?: number | null;
  ratedCurrent?: number | null;
  designSpeedRpm?: number | null;
  /** Rated / design capacity, e.g. 500 (see capacityUnit) — §11. */
  ratedCapacity?: number | null;
  /** Unit for ratedCapacity: kg, L, kW, t/h, ... — §11. */
  capacityUnit?: string;
  /** Year the machine was acquired / put into service — §11. */
  yearAcquired?: number | null;
  operatingHours: number;
  lastMaintenanceDate?: Date | null;
  /** Recommended maintenance interval in days — §11 / §14. */
  recommendedMaintenanceIntervalDays?: number | null;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  // ---- HICON HZB-160F ice maker specification (step 8) ---- //
  iceShape?: string;
  control?: string;
  /** Whole-unit power draw in watts (750). */
  powerW?: number | null;
  structure?: string;
  material?: string;
  application?: string;
  condensingMode?: string;
  filteringDevice?: boolean | null;
  autoCleaningDevice?: boolean | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  /** Physical dimensions, e.g. "566x450x508mm". */
  specification?: string;
  trademark?: string;
  origin?: string;
}

const machineSchema = new Schema<IMachine>(
  {
    machineId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    machineType: { type: String, required: true, trim: true },
    manufacturer: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    serialNumber: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    criticality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    installationDate: { type: Date, default: null },
    ratedPowerKw: { type: Number, default: null },
    ratedVoltage: { type: Number, default: null },
    ratedCurrent: { type: Number, default: null },
    designSpeedRpm: { type: Number, default: null },
    ratedCapacity: { type: Number, default: null },
    capacityUnit: { type: String, default: '', trim: true },
    yearAcquired: { type: Number, default: null },
    operatingHours: { type: Number, default: 0, min: 0 },
    lastMaintenanceDate: { type: Date, default: null },
    recommendedMaintenanceIntervalDays: { type: Number, default: null, min: 0 },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    iceShape: { type: String, default: '', trim: true },
    control: { type: String, default: '', trim: true },
    powerW: { type: Number, default: null },
    structure: { type: String, default: '', trim: true },
    material: { type: String, default: '', trim: true },
    application: { type: String, default: '', trim: true },
    condensingMode: { type: String, default: '', trim: true },
    filteringDevice: { type: Boolean, default: null },
    autoCleaningDevice: { type: Boolean, default: null },
    netWeightKg: { type: Number, default: null },
    grossWeightKg: { type: Number, default: null },
    specification: { type: String, default: '', trim: true },
    trademark: { type: String, default: '', trim: true },
    origin: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

export const Machine = model<IMachine>('Machine', machineSchema);
