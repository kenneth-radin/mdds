import { Schema, model, Document, Types } from 'mongoose';

export interface ITestingCase extends Document {
  _id: Types.ObjectId;
  machine: Types.ObjectId;
  maintenanceCase: Types.ObjectId | null;
  description: string;
  expectedSuggestion: string;
  actualSuggestion: string;
  matched: boolean;
  matchScore: number | null;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const testingCaseSchema = new Schema<ITestingCase>(
  {
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    maintenanceCase: { type: Schema.Types.ObjectId, ref: 'MaintenanceCase', default: null },
    description: { type: String, required: true, trim: true },
    expectedSuggestion: { type: String, required: true, trim: true },
    actualSuggestion: { type: String, required: true, trim: true },
    matched: { type: Boolean, required: true },
    matchScore: { type: Number, default: null },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const TestingCase = model<ITestingCase>('TestingCase', testingCaseSchema);
