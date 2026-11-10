import { Schema, model, Document } from 'mongoose';

export interface IRollupReading extends Document {
  machine: string;
  bucket: number; // Unix epoch ms bucket boundary
  avgTemperature: number;
  maxTemperature: number;
  minTemperature: number;
  avgVibration: number;
  maxVibration: number;
  minVibration: number;
  count: number;
  firstReading: number;
  lastReading: number;
}

const rollupSchema = new Schema<IRollupReading>(
  {
    machine: { type: String, required: true },
    bucket: { type: Number, required: true },
    avgTemperature: { type: Number, required: true },
    maxTemperature: { type: Number, required: true },
    minTemperature: { type: Number, required: true },
    avgVibration: { type: Number, required: true },
    maxVibration: { type: Number, required: true },
    minVibration: { type: Number, required: true },
    count: { type: Number, required: true },
    firstReading: { type: Number, required: true },
    lastReading: { type: Number, required: true },
  },
  { versionKey: false, timestamps: false }
);

// $merge on: ['machine', 'bucket'] requires a unique index on exactly those fields.
rollupSchema.index({ machine: 1, bucket: 1 }, { unique: true });

export const SensorReadingMinute = model<IRollupReading>(
  'SensorReadingMinute',
  rollupSchema,
  'sensorReadingMinute'
);

export const SensorReadingHour = model<IRollupReading>(
  'SensorReadingHour',
  rollupSchema,
  'sensorReadingHour'
);

export const SensorReadingDay = model<IRollupReading>(
  'SensorReadingDay',
  rollupSchema,
  'sensorReadingDay'
);