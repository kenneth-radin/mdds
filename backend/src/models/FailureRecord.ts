import { Schema, model, Document, Types } from 'mongoose';

export type FailureSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface IFailureRecord extends Document {
  _id: Types.ObjectId;
  machine: Types.ObjectId;
  date: Date;
  failureMode: string;
  cause: string;
  symptoms: string[];
  severity: FailureSeverity;
  downtimeHours: number;
  correctiveAction: string;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const failureRecordSchema = new Schema<IFailureRecord>(
  {
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    date: { type: Date, required: true },
    failureMode: { type: String, required: true, trim: true },
    cause: { type: String, default: '', trim: true },
    symptoms: { type: [String], default: [] },
    severity: { type: String, enum: ['minor', 'moderate', 'major', 'critical'], required: true },
    downtimeHours: { type: Number, default: 0, min: 0 },
    correctiveAction: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

failureRecordSchema.index({ machine: 1, date: -1 });

export const FailureRecord = model<IFailureRecord>('FailureRecord', failureRecordSchema);
