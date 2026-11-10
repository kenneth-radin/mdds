#!/usr/bin/env tsx
/**
 * One-time migration: convert existing SensorReading `date` fields from
 * MongoDB Date objects / ISO strings to Unix epoch milliseconds (numbers).
 *
 * Uses a server-side `updateMany` with `$toLong` so the conversion happens
 * inside MongoDB without fetching documents to Node.js.
 *
 * Handles two source types:
 *   1. Date objects stored as ISO dates in Mongo  →  $toLong converts to epoch ms
 *   2. ISO-string dates stored as strings          →  $dateToString → $toLong
 *
 * Run with:  npx tsx backend/scripts/migrate-dates-to-epoch.ts
 *
 * Prerequisites:
 *   - MONGODB_URI environment variable set (or .env file in backend/)
 *   - MongoDB is running and accessible
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mdss';

async function main() {
  console.log('[migrate] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // -----------------------------------------------------------
  // 1. Check for TTL indexes on the date field
  // -----------------------------------------------------------
  const indexes = await db.collection('sensorreadings').indexes();
  const ttlIndexes = indexes.filter((idx: any) => idx.expireAfterSeconds !== undefined);
  if (ttlIndexes.length > 0) {
    console.warn(
      `[migrate] WARNING: TTL indexes found on sensorreadings: ${JSON.stringify(ttlIndexes.map((i: any) => ({ name: i.name, key: i.key, expireAfterSeconds: i.expireAfterSeconds })))}`
    );
    console.warn('[migrate] Converting date from Date to Number will make TTL indexes ineffective until they are dropped/recreated.');
  } else {
    console.log('[migrate] No TTL indexes found on sensorreadings.date — safe to proceed.');
  }

  // -----------------------------------------------------------
  // 2. Count documents by date type before migration
  // -----------------------------------------------------------
  const totalBefore = await db.collection('sensorreadings').countDocuments({});
  const dateTypeCounts = await db.collection('sensorreadings').aggregate([
    { $group: { _id: { $type: '$date' }, count: { $sum: 1 } } },
  ]).toArray();
  console.log(`[migrate] Documents before: ${totalBefore}`);
  console.log('[migrate] Date type distribution:', JSON.stringify(dateTypeCounts, null, 2));

  // -----------------------------------------------------------
  // 3. Server-side updateMany: convert Date → epoch ms number
  //    $toLong works on Date objects; $dateFromString handles ISO strings.
  // -----------------------------------------------------------
  console.log('[migrate] Running server-side updateMany with $toLong...');

  const result = await db.collection('sensorreadings').updateMany(
    {
      // Match documents where date is NOT already a number
      $expr: { $ne: [{ $type: '$date' }, 'long'] },
    },
    [
      {
        $set: {
          date: {
            $switch: {
              branches: [
                // Case 1: date is already a Date object → $toLong converts to epoch ms
                { case: { $eq: [{ $type: '$date' }, 'date'] }, then: { $toLong: '$date' } },
                // Case 2: date is an ISO string → parse with $dateFromString, then $toLong
                {
                  case: { $eq: [{ $type: '$date' }, 'string'] },
                  then: {
                    $toLong: {
                      $dateFromString: { dateString: '$date', onError: null, onNull: null },
                    },
                  },
                },
              ],
              default: '$date', // leave as-is if unknown type
            },
          },
        },
      },
    ]
  );

  console.log(`[migrate] updateMany result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  // -----------------------------------------------------------
  // 4. Verify: count documents by date type after migration
  // -----------------------------------------------------------
  const totalAfter = await db.collection('sensorreadings').countDocuments({});
  const dateTypeCountsAfter = await db.collection('sensorreadings').aggregate([
    { $group: { _id: { $type: '$date' }, count: { $sum: 1 } } },
  ]).toArray();
  console.log(`[migrate] Documents after: ${totalAfter}`);
  console.log('[migrate] Date type distribution after:', JSON.stringify(dateTypeCountsAfter, null, 2));

  // -----------------------------------------------------------
  // 5. Spot-check: sample a few documents
  // -----------------------------------------------------------
  const samples = await db.collection('sensorreadings').find({}).limit(3).toArray();
  console.log('[migrate] Sample documents after migration:');
  for (const doc of samples) {
    console.log(`  _id=${doc._id}, date=${doc.date} (type=${typeof doc.date})`);
  }

  // -----------------------------------------------------------
  // 6. TTL index note
  // -----------------------------------------------------------
  if (ttlIndexes.length > 0) {
    console.warn('[migrate] NOTE: TTL indexes on epoch-ms numbers are not supported by MongoDB.');
    console.warn('[migrate] Consider dropping TTL indexes and implementing TTL in application code.');
  }

  console.log('[migrate] Migration complete.');
  await mongoose.disconnect();
  console.log('[migrate] Disconnected.');
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});