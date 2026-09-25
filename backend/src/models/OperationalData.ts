import { Schema, model, Document, Types } from 'mongoose';

export interface IOperationalData extends Document {
  _id: Types.ObjectId;
  machine: Types.ObjectId;
  date: Date;
  operatingHours: number;
  productionOutput?: number | null;
  downtimeHours: number;
  energyKwh?: number | null;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const operationalDataSchema = new Schema<IOperationalData>(
  {
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    date: { type: Date, required: true },
    operatingHours: { type: Number, default: 0, min: 0 },
    productionOutput: { type: Number, default: null },
    downtimeHours: { type: Number, default: 0, min: 0 },
    energyKwh: { type: Number, default: null },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

operationalDataSchema.index({ machine: 1, date: -1 });

export const OperationalData = model<IOperationalData>('OperationalData', operationalDataSchema);
