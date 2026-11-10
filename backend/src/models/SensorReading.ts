import { Schema, model, Document, Types } from 'mongoose';

// Timestamped sensor readings for the single compressor. Only temperature and
// vibration are retained here (voltage/current were dropped from the live feed).
// The `machine` field stores the machine code string directly (e.g. "CMP-001")
// instead of an ObjectId reference to avoid CastError on ingestion/read paths.
// The `date` field stores Unix epoch milliseconds (number) for consistent
// timestamp handling across MongoDB, Firebase, and API responses.

export interface ISensorReading extends Document {
  _id: Types.ObjectId;
  machine: string;
  date: number; // Unix epoch milliseconds
  temperature: number;
  vibration: number;
  humidity?: number; // optional, percent 0-100 (DHT11)
  operatingHours: number;
  source: string;
  syncedToFirebase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sensorReadingSchema = new Schema<ISensorReading>(
  {
    machine: { type: String, required: true, index: true },
    date: { type: Number, required: true, index: true },
    temperature: { type: Number, required: true, min: -50, max: 150 },
    vibration: { type: Number, required: true, min: 0, max: 20 },
    humidity: { type: Number, min: 0, max: 100 },
    operatingHours: { type: Number, required: true, min: 0, default: 0 },
    source: { type: String, default: 'manual', trim: true },
    syncedToFirebase: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

sensorReadingSchema.index({ machine: 1, date: -1 });

export const SensorReading = model<ISensorReading>('SensorReading', sensorReadingSchema);
