#!/usr/bin/env tsx
/**
 * Targeted data migration for the "test" database ONLY.
 *
 * Converts legacy SensorReading rows into the schema types the app expects:
 *
 *   1. `date`   : BSON Date / ISO string  ->  Unix epoch-ms number (via $toLong)
 *   2. `machine`: ObjectId                 ->  the machines doc's `machineId`
 *                 (e.g. 'CMP-001') resolved via the pre-loaded machineMap
 *
 * Behavior:
 *   - Refuses to run against any database whose name is not "test" (safety).
 *   - Dry run by default (reports counts, writes nothing).
 *   - Applies only when invoked with `--apply`.
 *   - Idempotent: only rows that actually need conversion are matched;
 *     operators leave already-clean rows untouched.
 *
 * Usage:
 *   npx tsx backend/scripts/migrate-test-data.ts           # dry run
 *   npx tsx backend/scripts/migrate-test-data.ts --apply   # apply
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env' });

const BASE_URI = process.env.MONGODB_URI;
if (!BASE_URI) {
  console.error('[migrate-test] MONGODB_URI is not set.');
  process.exit(1);
}

// Force the "test" database regardless of what the URI's path is.
function testUri(): string {
  const u = new URL(BASE_URI as string);
  u.pathname = '/test';
  return u.toString();
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const uri = testUri();
  console.log('[migrate-test] Connecting to database "test"...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  // Hard safety: the connection MUST resolve to the "test" database.
  if (db.databaseName !== 'test') {
    throw new Error(
      `[migrate-test] ABORT: connected to database "${db.databaseName}", expected "test". Refusing to continue.`
    );
  }
  console.log(`[migrate-test] Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[migrate-test] Database name: ${db.databaseName}`);

  // -----------------------------------------------------------
  // 1. Load machines _id -> machineId lookup for ObjectId resolution.
  // -----------------------------------------------------------
  const machineMap = new Map<string, string>();
  const machines = await db
    .collection('machines')
    .find({}, { projection: { _id: 1, machineId: 1 } })
    .toArray();
  for (const m of machines) {
    machineMap.set(m._id.toString(), m.machineId);
  }
  console.log(`[migrate-test] machines docs loaded: ${machineMap.size}`);

  // -----------------------------------------------------------
  // 2. Category counts (dry-run analysis)
  // -----------------------------------------------------------
  const dateTypeCounts = await db
    .collection('sensorreadings')
    .aggregate([
      { $group: { _id: { $type: '$date' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  console.log(
    '[migrate-test] date $type distribution:',
    JSON.stringify(dateTypeCounts)
  );

  const machineTypeCounts = await db
    .collection('sensorreadings')
    .aggregate([
      { $group: { _id: { $type: '$machine' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  // Rows with Date-typed date (need conversion) — includes ISO example strings too.
  const datesToConvert = await db.collection('sensorreadings').countDocuments({
    $expr: { $in: [{ $type: '$date' }, ['date', 'string']] },
  });

  // Rows with ObjectId-typed machine (need conversion to machineId code).
  const machinesToConvert = await db.collection('sensorreadings').countDocuments({
    $expr: { $eq: [{ $type: '$machine' }, 'objectId'] },
  });

  // Rows already clean: numeric date AND string machine.
  const alreadyClean = await db.collection('sensorreadings').countDocuments({
    $expr: { $eq: [{ $type: '$date' }, 'long'] },
    $and: [{ $expr: { $eq: [{ $type: '$machine' }, 'string'] } }],
  });

  const total = await db.collection('sensorreadings').countDocuments({});

  console.log('[migrate-test] --- DRY-RUN COUNTS ---');
  console.log(`[migrate-test] dates_to_convert: ${datesToConvert}`);
  console.log(`[migrate-test] machines_to_convert: ${machinesToConvert}`);
  console.log(`[migrate-test] already_clean: ${alreadyClean}`);
  console.log(`[migrate-test] total_rows: ${total}`);

  // -----------------------------------------------------------
  // 3. Normalize `machine` ObjectId -> machineId string.
  //    $lookup is NOT allowed inside an update pipeline, so resolve each
  //    ObjectId -> machineId with the pre-loaded machineMap (per entry,
  //    using a direct $set). Only objectId-typed rows are matched;
  //    already-string rows are untouched.
  // -----------------------------------------------------------

  // 3a. Detect objectId-typed machine values that have NO mapping entry,
  //     so they can be reported (and left untouched).
  const distinctObjectIds = await db
    .collection('sensorreadings')
    .aggregate([
      { $match: { $expr: { $eq: [{ $type: '$machine' }, 'objectId'] } } },
      { $group: { _id: '$machine', count: { $sum: 1 } } },
    ])
    .toArray();

  let unmappedRows = 0;
  for (const row of distinctObjectIds) {
    const id = row._id.toString();
    if (!machineMap.has(id)) {
      unmappedRows += row.count;
      console.warn(
        `[migrate-test] UNMAPPED ObjectId ${id} -> ${row.count} row(s) will be left untouched`
      );
    }
  }
  console.log(`[migrate-test] unmapped ObjectId rows (expected 0): ${unmappedRows}`);

  let machineMatched = 0;
  let machineModified = 0;

  for (const [objectIdHex, machineId] of machineMap) {
    // Skip an ObjectId that no longer exists in the readings collection.
    const exists = distinctObjectIds.some((row) => row._id.toString() === objectIdHex);
    if (!exists) continue;

    const match = { machine: new mongoose.Types.ObjectId(objectIdHex) };
    if (!APPLY) {
      const n = await db.collection('sensorreadings').countDocuments(match);
      machineMatched += n;
      console.log(
        `[migrate-test] (dry) ${objectIdHex} -> "${machineId}": ${n} row(s) would be updated`
      );
      continue;
    }

    const res = await db
      .collection('sensorreadings')
      .updateMany(match, { $set: { machine: machineId } });
    machineMatched += res.matchedCount;
    machineModified += res.modifiedCount;
    console.log(
      `[migrate-test] ${objectIdHex} -> "${machineId}": matched=${res.matchedCount}, modified=${res.modifiedCount}`
    );
  }

  console.log(
    `[migrate-test] machine updateMany (total): matched=${machineMatched}, modified=${machineModified}`
  );

  if (!APPLY) {
    console.log(
      '[migrate-test] DRY RUN complete — no changes applied. Re-run with --apply to migrate.'
    );
    await mongoose.disconnect();
    return;
  }

  // -----------------------------------------------------------
  // 4. APPLY: normalize `date` to epoch-ms number. $toLong works for
  //    Date and ISO strings; numeric rows are not matched at all.
  //    (Kept last/after machine so the machine step, which is the only
  //    step with data to convert, runs first.)
  // -----------------------------------------------------------
  const dateResult = await db.collection('sensorreadings').updateMany(
    { $expr: { $in: [{ $type: '$date' }, ['date', 'string']] } },
    [{ $set: { date: { $toLong: '$date' } } }]
  );
  console.log(
    `[migrate-test] date updateMany: matched=${dateResult.matchedCount}, modified=${dateResult.modifiedCount}`
  );

  // -----------------------------------------------------------
  // 5. Post-apply verification
  // -----------------------------------------------------------
  const dateAfter = await db.collection('sensorreadings').countDocuments({
    $expr: { $eq: [{ $type: '$date' }, 'long'] },
  });
  const machineAfter = await db.collection('sensorreadings').countDocuments({
    $expr: { $eq: [{ $type: '$machine' }, 'string'] },
  });
  const totalAfter = await db.collection('sensorreadings').countDocuments({});
  console.log('[migrate-test] --- POST-APPLY ---');
  console.log(`[migrate-test] numeric_date_rows: ${dateAfter} / ${totalAfter}`);
  console.log(`[migrate-test] string_machine_rows: ${machineAfter} / ${totalAfter}`);

  console.log('[migrate-test] APPLY complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrate-test] Fatal error:', err);
  process.exit(1);
});