import { Schema, model, Document, Types } from 'mongoose';

export interface IMachineState extends Document {
  _id: Types.ObjectId;
  machine: string;
  state: 'starting' | 'operating' | 'stopped';
  changedAt: number;
  changedBy: string | null;
  /** Optional tag for seeded/fabricated data so it can be cleaned idempotently. */
  seedTag?: string;
}

const machineStateSchema = new Schema<IMachineState>(
  {
    machine: { type: String, required: true, index: true },
    state: {
      type: String,
      enum: ['starting', 'operating', 'stopped'],
      required: true,
    },
    changedAt: { type: Number, required: true, default: () => Date.now() },
    changedBy: { type: String, default: null, trim: true },
    seedTag: { type: String, default: undefined, trim: true }
  },
  { timestamps: true }
);

// Fast lookup of the latest state entry per machine (most recent changedAt).
// The mobile screen and the anomaly pipeline both read this index.
machineStateSchema.index({ machine: 1, changedAt: -1 });

export const MachineState = model<IMachineState>('MachineState', machineStateSchema);
