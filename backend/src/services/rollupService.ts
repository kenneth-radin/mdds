/**
 * Rollup service for sensor readings.
 *
 * Aggregates raw SensorReading documents into per-minute, per-hour, and per-day
 * rollup collections for efficient charting at longer time ranges.
 *
 * Raw data remains queryable (paginated/limited) via /sensor-data/historical.
 * Rollups are used when the requested time range exceeds ~1 hour of raw data.
 *
 * NOTE: `date` is stored as Unix epoch milliseconds (number), not a Date object.
 * Bucket boundaries are computed in Node.js from the epoch ms number, and rolled-up
 * documents store their bucket timestamp as an epoch ms number (not a Date) so that
 * historical queries never hit a Date/number type mismatch one layer up.
 */

import { SensorReading } from '../models/SensorReading';
import {
  SensorReadingMinute,
  SensorReadingHour,
  SensorReadingDay,
} from '../models/Rollup';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/db';

const MINUTE_COLLECTION = 'sensorReadingMinute';
const HOUR_COLLECTION = 'sensorReadingHour';
const DAY_COLLECTION = 'sensorReadingDay';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const SHANGHAI_OFFSET_MS = 28_800_000;

/**
 * Truncate an epoch-ms timestamp to the start of its UTC minute.
 */
function truncateToMinute(epochMs: number): number {
  return Math.floor(epochMs / MS_PER_MINUTE) * MS_PER_MINUTE;
}

/**
 * Truncate an epoch-ms timestamp to the start of its UTC hour.
 */
function truncateToHour(epochMs: number): number {
  return Math.floor(epochMs / MS_PER_HOUR) * MS_PER_HOUR;
}

/**
 * Truncate an epoch-ms timestamp to the start of its Asia/Shanghai day.
 * Shanghai is UTC+8, so we shift by +8h before taking the day modulus.
 */
function truncateToDayShanghai(epochMs: number): number {
  return epochMs - ((epochMs + SHANGHAI_OFFSET_MS) % MS_PER_DAY);
}

/**
 * Build the $group _id fields using epoch-ms bucket boundaries instead of
 * MongoDB date operators ($minute, $hour, $dayOfMonth, etc.), which only work
 * on Date-typed fields.
 */
function buildIdFields(collectionName: string): any {
  const idFields: any = { machine: '$machine' };

  // `date` may be a BSON Date (legacy data) or an epoch-ms number. Wrap it
  // with $toLong so bucketing arithmetic always operates on numeric
  // milliseconds: $mod and $add reject Date operands.
  if (collectionName === MINUTE_COLLECTION) {
    idFields.bucket = {
      $subtract: [{ $toLong: '$date' }, { $mod: [{ $toLong: '$date' }, MS_PER_MINUTE] }],
    };
  } else if (collectionName === HOUR_COLLECTION) {
    idFields.bucket = {
      $subtract: [{ $toLong: '$date' }, { $mod: [{ $toLong: '$date' }, MS_PER_HOUR] }],
    };
  } else {
    // DAY_COLLECTION — Asia/Shanghai day bucket
    idFields.bucket = {
      $subtract: [
        { $toLong: '$date' },
        { $mod: [{ $add: [{ $toLong: '$date' }, SHANGHAI_OFFSET_MS] }, MS_PER_DAY] },
      ],
    };
  }

  return idFields;
}

function buildMergeOn(collectionName: string): string[] {
  return ['machine', 'bucket'];
}

/** Ensure unique indexes exist on all rollup collections before $merge runs. */
async function ensureRollupIndexes(): Promise<void> {
  try {
    await SensorReadingMinute.createIndexes();
    await SensorReadingHour.createIndexes();
    await SensorReadingDay.createIndexes();
  } catch (error) {
    // A failed index build must never block API startup or crash the process.
    // If the unique index truly cannot be built (e.g. duplicate data), the
    // subsequent $merge will fail cleanly and is caught by the callers below.
    console.error('[rollup] Failed to ensure rollup indexes:', error);
  }
}

export async function buildRollups(
  collectionName: string,
  startMs: number,
  endMs: number
): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const idFields = buildIdFields(collectionName);
  const mergeOn = buildMergeOn(collectionName);

  const pipeline: any[] = [
    {
      // Only roll up documents whose `date` is a BSON Date or a number. This
      // guard keeps the $toLong / $mod bucket arithmetic below from ever
      // failing on string/missing/other values.
      $match: {
        date: { $type: ['date', 'number'] },
      },
    },
    {
      // Normalize date to an epoch-ms number so range matching and bucketing
      // are type-safe for both BSON Date (legacy data) and numeric dates.
      $addFields: {
        dateMs: { $toLong: '$date' },
      },
    },
    {
      $match: {
        dateMs: { $gte: startMs, $lte: endMs },
      },
    },
    {
      // Normalize `machine` to the string machine code for BOTH source forms:
      //   - ObjectId → resolve via `machines` by _id to the doc's `machineId`
      //   - string   → unchanged ($toString of a string is a no-op)
      // Rollups therefore always carry 'CMP-001' instead of a raw ObjectId.
      $lookup: {
        from: 'machines',
        localField: 'machine',
        foreignField: '_id',
        as: 'machineLookup',
      },
    },
    {
      $addFields: {
        machine: {
          $cond: [
            { $gt: [{ $size: '$machineLookup' }, 0] },
            { $arrayElemAt: ['$machineLookup.machineId', 0] },
            { $toString: '$machine' },
          ],
        },
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
        firstReading: { $min: '$dateMs' },
        lastReading: { $max: '$dateMs' },
      },
    },
    {
      // Hoist the composite _id {machine, bucket} to top-level fields: $merge
      // `on: ['machine', 'bucket']` matches against TOP-LEVEL document fields,
      // and the stored rollup documents are queried by top-level `machine` /
      // `bucket` (see scripts/test-rollup.ts and historical queries).
      $project: {
        _id: 0,
        machine: '$_id.machine',
        bucket: '$_id.bucket',
        avgTemperature: 1,
        maxTemperature: 1,
        minTemperature: 1,
        avgVibration: 1,
        maxVibration: 1,
        minVibration: 1,
        count: 1,
        firstReading: 1,
        lastReading: 1,
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
  await ensureRollupIndexes();

  const endMs = Date.now();
  const startMs = endMs - 30 * 24 * 60 * 60 * 1000; // last 30 days

  try {
    await buildRollups(MINUTE_COLLECTION, startMs, endMs);
    await buildRollups(HOUR_COLLECTION, startMs, endMs);
    await buildRollups(DAY_COLLECTION, startMs, endMs);
    console.log('[rollup] Rollup aggregation completed');
  } catch (error) {
    console.error('[rollup] Rollup aggregation failed:', error);
  }
}

/**
 * Backfill ALL history (not just a recent window) for all rollup collections,
 * since the scheduler's 30-day window won't cover historical data that exists
 * before the scheduler was started.
 */
export async function backfillAllHistory(): Promise<void> {
  if (!isDatabaseConnected()) return;
  await ensureRollupIndexes();

  const db = mongoose.connection.db;
  if (!db) return;

  // Get the full date range of existing data as numeric epoch-ms bounds, so
  // the $match below can compare against a numeric `dateMs` regardless of
  // whether `date` is stored as a BSON Date or a number.
  const range = await db.collection('sensorreadings').aggregate([
    {
      $group: {
        _id: null,
        minDate: { $min: { $toLong: '$date' } },
        maxDate: { $max: { $toLong: '$date' } },
      },
    },
  ]).toArray();

  if (range.length === 0) {
    console.log('[rollup] No data to backfill.');
    return;
  }

  const startMs = range[0].minDate;
  const endMs = range[0].maxDate;

  console.log(`[rollup] Backfilling all history from ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()}`);

  let failedStage = 'minute';
  try {
    await buildRollups(MINUTE_COLLECTION, startMs, endMs);
    failedStage = 'hour';
    await buildRollups(HOUR_COLLECTION, startMs, endMs);
    failedStage = 'day';
    await buildRollups(DAY_COLLECTION, startMs, endMs);
    console.log('[rollup] Full-history backfill completed');
  } catch (error) {
    console.error(`[rollup] Full-history backfill failed at ${failedStage} stage:`, error);
  }
}

export async function startRollupScheduler(): Promise<void> {
  // Run initial rollup immediately
  await rollupReadings();

  // Also backfill all history on first start (one-time)
  await backfillAllHistory();

  // Then re-run every hour
  setInterval(rollupReadings, 60 * 60 * 1000);
  console.log('[rollup] Scheduler started (runs every hour)');
}