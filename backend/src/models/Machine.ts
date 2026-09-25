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
  operatingHours: number;
  lastMaintenanceDate?: Date | null;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
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
    operatingHours: { type: Number, default: 0, min: 0 },
    lastMaintenanceDate: { type: Date, default: null },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Machine = model<IMachine>('Machine', machineSchema);
