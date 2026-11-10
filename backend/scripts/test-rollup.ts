#!/usr/bin/env tsx
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { rollupReadings } from '../src/services/rollupService';

dotenv.config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mdss';
const MACHINE = 'CMP-001';
const NOW = Date.now();

function generateReadings(): any[] {
  const readings: any[] = [];
  const baseTemp = 70;
  const baseVib = 2.5;
  for (let i = 0; i < 48; i++) {
    const ts = NOW - (47 - i) * 5 * 60 * 1000;
    readings.push({
      machine: MACHINE,
      date: ts,
      temperature: baseTemp + Math.sin(i / 4) * 5 + (Math.random() - 0.5),
      vibration: baseVib + Math.cos(i / 6) * 0.5 + (Math.random() - 0.5) * 0.2,
      operatingHours: 1000 + i,
      source: 'test',
      syncedToFirebase: true,
    });
  }
  return readings;
}

async function checkRollup(collection: string, divisor: number, label: string): Promise<number> {
  const docs = await mongoose.connection.db!.collection(collection)
    .find({ machine: MACHINE, source: 'test' })
    .sort({ bucket: 1 })
    .limit(3)
    .toArray();
  console.log(`[test] ${label}: ${docs.length} docs`);
  for (const doc of docs) {
    const isNum = typeof doc.bucket === 'number';
    console.log(`  bucket=${doc.bucket} (number=${isNum}) avgTemp=${(doc.avgTemperature ?? 0).toFixed(2)} count=${doc.count}`);
    if (!isNum) { console.error(`  ERROR: bucket type=${typeof doc.bucket}`); process.exit(1); }
    if (doc.bucket % divisor !== 0) { console.error(`  ERROR: bucket ${doc.bucket} not aligned`); process.exit(1); }
  }
  return docs.length;
}

async function main() {
  console.log('[test] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  await db.collection('sensorreadings').deleteMany({ machine: MACHINE, source: 'test' });
  await Promise.all([
    db.collection('sensorReadingMinute').deleteMany({ machine: MACHINE }),
    db.collection('sensorReadingHour').deleteMany({ machine: MACHINE }),
    db.collection('sensorReadingDay').deleteMany({ machine: MACHINE }),
  ]);

  const readings = generateReadings();
  await db.collection('sensorreadings').insertMany(readings);
  console.log(`[test] Inserted ${readings.length} test readings.`);

  const rawCount = await db.collection('sensorreadings').countDocuments({ machine: MACHINE, source: 'test' });
  console.log(`[test] Raw reading count: ${rawCount}`);

  await rollupReadings();

  const minuteCount = await db.collection('sensorReadingMinute').countDocuments({ machine: MACHINE });
  console.log(`[test] Minute rollup count: ${minuteCount}`);
  await checkRollup('sensorReadingMinute', 60_000, 'Minute rollup');

  const hourCount = await db.collection('sensorReadingHour').countDocuments({ machine: MACHINE });
  console.log(`[test] Hour rollup count: ${hourCount}`);
  await checkRollup('sensorReadingHour', 3_600_000, 'Hour rollup');

  const dayCount = await db.collection('sensorReadingDay').countDocuments({ machine: MACHINE });
  console.log(`[test] Day rollup count: ${dayCount}`);
  await checkRollup('sensorReadingDay', 86_400_000, 'Day rollup');

  const firstMinute = await db.collection('sensorReadingMinute')
    .findOne({ machine: MACHINE }, { sort: { bucket: 1 } });
  console.log(`[test] firstReading type: ${typeof firstMinute?.firstReading}, lastReading type: ${typeof firstMinute?.lastReading}`);
  if (typeof firstMinute?.firstReading !== 'number' || typeof firstMinute?.lastReading !== 'number') {
    console.error('ERROR: firstReading/lastReading not numbers');
    process.exit(1);
  }

  await db.collection('sensorreadings').deleteMany({ machine: MACHINE, source: 'test' });
  await Promise.all([
    db.collection('sensorReadingMinute').deleteMany({ machine: MACHINE }),
    db.collection('sensorReadingHour').deleteMany({ machine: MACHINE }),
    db.collection('sensorReadingDay').deleteMany({ machine: MACHINE }),
  ]);
  console.log('[test] Cleaned up.');
  console.log('[test] All rollup tests PASSED.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[test] Fatal error:', err);
  process.exit(1);
});