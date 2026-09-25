import { Schema, model, Document, Types } from 'mongoose';

export type MaintenanceType = 'preventive' | 'corrective' | 'predictive' | 'inspection' | 'overhaul';

export interface IMaintenanceRecord extends Document {
  _id: Types.ObjectId;
  machine: Types.ObjectId;
  date: Date;
  maintenanceType: MaintenanceType;
  problem: string;
  action: string;
  partsReplaced: string[];
  technician: string;
  startTime?: Date | null;
  endTime?: Date | null;
  downtimeHours: number;
  cost?: number | null;
  productionLossUnits?: number | null;
  energyKwh?: number | null;
  status: string;
  result: string;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceRecordSchema = new Schema<IMaintenanceRecord>(
  {
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    date: { type: Date, required: true },
    maintenanceType: {
      type: String,
      enum: ['preventive', 'corrective', 'predictive', 'inspection', 'overhaul'],
      required: true
    },
    problem: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    partsReplaced: { type: [String], default: [] },
    technician: { type: String, default: '', trim: true },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    downtimeHours: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: null },
    productionLossUnits: { type: Number, default: null },
    energyKwh: { type: Number, default: null },
    status: { type: String, default: 'completed', trim: true },
    result: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

maintenanceRecordSchema.index({ machine: 1, date: -1 });

export const MaintenanceRecord = model<IMaintenanceRecord>('MaintenanceRecord', maintenanceRecordSchema);
