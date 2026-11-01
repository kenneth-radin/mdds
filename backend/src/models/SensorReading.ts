import { Schema, model, Document, Types } from 'mongoose';

// Timestamped sensor readings for the single compressor. Only temperature and
// vibration are retained here (voltage/current were dropped from the live feed).
// The `machine` field is the FK to the (single) Machine record seeded at startup.

export interface ISensorReading extends Document {
  _id: Types.ObjectId;
  machine: Types.ObjectId;
  date: Date;
  temperature: number;
  vibration: number;
  operatingHours: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const sensorReadingSchema = new Schema<ISensorReading>(
  {
    machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
    date: { type: Date, required: true },
    temperature: { type: Number, required: true, min: -50, max: 150 },
    vibration: { type: Number, required: true, min: 0, max: 20 },
    operatingHours: { type: Number, required: true, min: 0, default: 0 },
    source: { type: String, default: 'manual', trim: true }
  },
  { timestamps: true }
);

sensorReadingSchema.index({ machine: 1, date: -1 });

export const SensorReading = model<ISensorReading>('SensorReading', sensorReadingSchema);
