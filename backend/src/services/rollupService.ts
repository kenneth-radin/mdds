/**
 * Rollup service for sensor readings.
 *
 * Aggregates raw SensorReading documents into per-minute, per-hour, and per-day
 * rollup collections for efficient charting at longer time ranges.
 *
 * Raw data remains queryable (paginated/limited) via /sensor-data/historical.
 * Rollups are used when the requested time range exceeds ~1 hour of raw data.
 */

import { SensorReading } from '../models/SensorReading';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/db';

const MINUTE_COLLECTION = 'sensorReadingMinute';
const HOUR_COLLECTION = 'sensorReadingHour';
const DAY_COLLECTION = 'sensorReadingDay';

function truncateToMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

function truncateToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function truncateToDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildIdFields(rangeDays: number): any {
  const idFields: any = { machine: '$machine' };
  if (rangeDays <= 1) {
    idFields.minute = { $minute: '$date' };
    idFields.hour = { $hour: '$date' };
    idFields.day = { $dayOfMonth: '$date' };
    idFields.month = { $month: '$date' };
    idFields.year = { $year: '$date' };
  } else if (rangeDays <= 30) {
    idFields.hour = { $hour: '$date' };
    idFields.day = { $dayOfMonth: '$date' };
    idFields.month = { $month: '$date' };
    idFields.year = { $year: '$date' };
  } else {
    idFields.day = { $dayOfMonth: '$date' };
    idFields.month = { $month: '$date' };
    idFields.year = { $year: '$date' };
  }
  return idFields;
}

function buildMergeOn(idFields: any): string[] {
  return Object.keys(idFields).filter((k) => k !== 'machine');
}

async function buildRollups(
  collectionName: string,
  truncateFn: (date: Date) => Date,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const rangeDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const idFields = buildIdFields(rangeDays);
  const mergeOn = buildMergeOn(idFields);

  const pipeline: any[] = [
    {
      $match: {
        machine: 'CMP-001',
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: idFields,
        avgTemperature: { $avg: '$temperature' },
        maxTemperature: { $max: '$temperature' },
        minTemperature: { $min: '$temperature' },
        avgVibration: { $avg: '$vibration' },
        maxVibration: { $max: '$vibration' },
        minVibration: { $min: '$vibration' },
        count: { $sum: 1 },
        firstReading: { $min: '$date' },
        lastReading: { $max: '$date' },
      },
    },
    {
      $merge: {
        into: collectionName,
        on: mergeOn,
        whenMatched: 'merge',
        whenNotMatched: 'insert',
      },
    },
  ];

  await db.collection('sensorreadings').aggregate(pipeline).toArray();
}

export async function rollupReadings(): Promise<void> {
  if (!isDatabaseConnected()) return;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days

  try {
    await buildRollups(MINUTE_COLLECTION, truncateToMinute, startDate, endDate);
    await buildRollups(HOUR_COLLECTION, truncateToHour, startDate, endDate);
    await buildRollups(DAY_COLLECTION, truncateToDay, startDate, endDate);
    console.log('[rollup] Rollup aggregation completed');
  } catch (error) {
    console.error('[rollup] Rollup aggregation failed:', error);
  }
}

export async function startRollupScheduler(): Promise<void> {
  // Run initial rollup immediately
  await rollupReadings();

  // Then re-run every hour
  setInterval(rollupReadings, 60 * 60 * 1000);
  console.log('[rollup] Scheduler started (runs every hour)');
}