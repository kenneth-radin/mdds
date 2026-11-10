/**
 * Integration test: Phases 1-4 against the REAL Express app over HTTP
 * (in-memory MongoDB).
 *
 *  Phase 1 - Migration / date types: numeric epoch-ms `date` on SensorReading.
 *  Phase 2 - Rollup persistence (minute/hour/day buckets).
 *  Phase 2.5 - Machine-state flagging API (POST state / current / history).
 *  Phase 3 - State-machine gating of alerts:
 *            starting/stopped  -> readings stored, NO alerts, NO detector run
 *            operating        -> z-score baseline resets at the operating
 *                                transition; alerts resume and are suppressed
 *                                by the partial unique index under concurrency.
 *
 * Firebase: '../src/firebase-admin' is mocked via vi.mock. The ingestion route
 * pushes to TWO refs - 'alerts' (only when an anomaly alert is saved) and
 * 'sensorReadings' (on every POST) - so assertions filter calls by ref path.
 *
 * dotenv: the app loads backend/.env itself via src/config/env.ts
 * (path.resolve(__dirname, '../../.env')). There is no .env.local anywhere in
 * the backend. DEVICE_INGEST_KEY comes from backend/.env.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock('../src/firebase-admin', () => ({
  admin: null,
  firestore: null,
  initialized: true,
  db: {
    ref: (path: string) => ({
      push: async (data: unknown) => {
        mockPush(path, data);
        return { key: 'mock-key' };
      },
    }),
  },
}));

// rollupReadings() is guarded by isDatabaseConnected() (set only by
// connectDatabase(), which would use the Atlas URI from backend/.env). The test
// connects mongoose directly to the in-memory server, so make the guard reflect
// the real mongoose connection state instead of the stale flag.
vi.mock('../src/config/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/db')>();
  const m = await import('mongoose');
  return {
    ...actual,
    isDatabaseConnected: () => m.default.connection.readyState === 1,
  };
});

import mongoose from 'mongoose';

import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { Alert } from '../src/models/Alert';
import { SensorReading } from '../src/models/SensorReading';
import { MachineState } from '../src/models/MachineState';
import { Machine } from '../src/models/Machine';
import { rollupReadings, buildRollups } from '../src/services/rollupService';

const MINUTE_COLLECTION = 'sensorReadingMinute';
const HOUR_COLLECTION = 'sensorReadingHour';
const DAY_COLLECTION = 'sensorReadingDay';

const MACHINE = 'CMP-001';
const DEVICE_KEY = process.env.DEVICE_INGEST_KEY || '';
if (!DEVICE_KEY) {
  throw new Error('DEVICE_INGEST_KEY missing - backend/.env was not loaded by src/config/env.ts');
}

let mongoServer: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushesTo(refPath: string) {
  return mockPush.mock.calls.filter((c) => c[0] === refPath);
}

async function postDeviceReading(temperature: number, vibration: number, timestamp: number) {
  return request(app)
    .post('/api/devices/readings')
    .set('X-Device-Key', DEVICE_KEY)
    .send({ temperature, vibration, timestamp });
}
async function postState(state: string, changedBy?: string) {
  return request(app)
    .post(`/api/machines/${MACHINE}/state`)
    .send({ state, changedBy });
}

async function getState() {
  return request(app).get(`/api/machines/${MACHINE}/state`);
}

async function getStateHistory() {
  return request(app).get(`/api/machines/${MACHINE}/state/history?limit=10`);
}

async function setupMongoServer(): Promise<void> {
  console.log('[test] Starting in-memory MongoDB server...');
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'mdss_integration' },
  });
  const uri = mongoServer.getUri('mdss_integration');
  console.log(`[test] MongoDB URI: ${uri}`);
  process.env.MONGODB_URI = uri;
}

async function setupDatabase(): Promise<void> {
  await mongoose.connect(mongoServer.getUri('mdss_integration'));
  const db = mongoose.connection.db!;
  const dbName = db.databaseName;
  console.log(`[test] Database name: ${dbName}`);

  // Safety guard: never run against the shared Atlas "test" database (where
  // real sensorreadings live). The in-memory server DB name is a random
  // string, so "test" here would mean we accidentally pointed at Atlas.
  if (dbName === 'test') {
    throw new Error(
      '[test] ABORT: connected to database "test" (real data). Refusing to run the integration suite against it.'
    );
  }

  // Second guard: refuse to run if the target collection already contains
  // documents this suite did not seed (i.e. it is not a fresh/reset DB).
  const preExisting = await db.collection('sensorreadings').countDocuments({});
  if (preExisting > 0) {
    throw new Error(
      `[test] ABORT: sensorreadings already has ${preExisting} document(s) before seeding. Expected an empty collection.`
    );
  }

  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop().catch(() => {});
  }
  console.log('[test] Database reset.');
}

async function cleanup(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    console.log('[test] In-memory MongoDB stopped.');
  }
}
// ---------- Phase 1: Migration / date types ---------- //
async function runPhase1(): Promise<void> {
  console.log('\n=== PHASE 1: Migration / Date Types ===');
  mockPush.mockClear();

  const now = Date.now();
  const res = await postDeviceReading(25.5, 1.0, now);

  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  // Normal reading -> no anomaly object
  expect(res.body.anomaly).toBeNull();
  console.log('[phase1] HTTP 200, body:', JSON.stringify(res.body));

  const reading = await SensorReading.findOne({ machine: MACHINE }).lean();
  expect(reading).not.toBeNull();
  expect(typeof reading!.date).toBe('number');
  expect(reading!.date).toBe(now);
  console.log(`[phase1] Stored SensorReading.date=${reading!.date} (typeof ${typeof reading!.date})`);

  // Every POST pushes the raw reading to the 'sensorReadings' ref exactly once
  expect(pushesTo('sensorReadings')).toHaveLength(1);
  // No anomaly -> zero 'alerts' pushes
  expect(pushesTo('alerts')).toHaveLength(0);
  console.log('[phase1] Firebase sensorReadings pushes: 1, alerts pushes: 0');
  console.log('[phase1] PASSED.');
}

// ---------- Phase 2: Rollup persistence ---------- //
async function runPhase2(): Promise<void> {
  console.log('\n=== PHASE 2: Rollup Persistence ===');

  // 48 readings, one every 5 minutes over the last 4 hours
  const now = Date.now();
  const readings = [];
  for (let i = 0; i < 48; i++) {
    readings.push({
      machine: MACHINE,
      temperature: 70 + Math.sin(i / 4) * 5 + (Math.random() - 0.5),
      vibration: 1.0 + Math.cos(i / 6) * 0.3 + (Math.random() - 0.5) * 0.1,
      operatingHours: 1000 + i,
      date: now - (47 - i) * 5 * 60 * 1000,
      source: 'test',
      syncedToFirebase: true,
    });
  }
  await SensorReading.insertMany(readings);
  const rawCount = await SensorReading.countDocuments({ machine: MACHINE, source: 'test' });
  expect(rawCount).toBe(48);
  console.log(`[phase2] Seeded ${rawCount} raw readings`);

  // rollupReadings() uses $merge with on:['machine','bucket'], which MongoDB
  // rejects unless a unique index exists on those fields. NOTE: no code in
  // this repo creates that index (verified by search) - on Atlas it must have
  // been created manually. Create it here to mirror the production prerequisite.
  const dbSetup = mongoose.connection.db!;
  for (const col of ['sensorReadingMinute', 'sensorReadingHour', 'sensorReadingDay']) {
    await dbSetup.collection(col).createIndex({ machine: 1, bucket: 1 }, { unique: true });
  }
  console.log('[phase2] Unique {machine,bucket} indexes created on rollup collections');

  await rollupReadings();

  const db = mongoose.connection.db!;
  const minuteDocs = await db.collection('sensorReadingMinute').find({ machine: MACHINE }).toArray();
  const hourDocs = await db.collection('sensorReadingHour').find({ machine: MACHINE }).toArray();
  const dayDocs = await db.collection('sensorReadingDay').find({ machine: MACHINE }).toArray();
  console.log(`[phase2] Rollup docs: minute=${minuteDocs.length}, hour=${hourDocs.length}, day=${dayDocs.length}`);

  expect(minuteDocs.length).toBeGreaterThan(0);
  expect(hourDocs.length).toBeGreaterThan(0);
  expect(dayDocs.length).toBeGreaterThan(0);

  for (const doc of minuteDocs) {
    expect(typeof doc.bucket).toBe('number');
    expect(doc.bucket % 60_000).toBe(0);
    expect(doc.count).toBeGreaterThan(0);
    expect(typeof doc.firstReading).toBe('number');
    expect(typeof doc.lastReading).toBe('number');
  }
  for (const doc of hourDocs) {
    expect(typeof doc.bucket).toBe('number');
    expect(doc.bucket % 3_600_000).toBe(0);
  }
  for (const doc of dayDocs) {
    expect(typeof doc.bucket).toBe('number');
    // Day buckets are truncated to Asia/Shanghai (UTC+8) midnight
    expect((doc.bucket + 28_800_000) % 86_400_000).toBe(0);
  }
  const totalRolledUp = minuteDocs.reduce((sum, d) => sum + d.count, 0);
  expect(totalRolledUp).toBe(49); // 48 seeded + 1 from Phase 1
  console.log(`[phase2] Minute buckets aligned to 60000ms, total rolled-up count=${totalRolledUp}`);
  console.log('[phase2] PASSED.');
}
// ---------- Phase 4: Date-typed and ObjectId-machine rollup test ---------- //
async function runPhase4(): Promise<void> {
  console.log('\\n=== PHASE 4: Date-Typed and ObjectId-Machine Rollups ===');

  const now = Date.now();

  // Isolate Phase 4 from prior phases: clear all raw readings and rollups so
  // the 25 seeded rows below are the only inputs to this phase's assertions.
  await SensorReading.deleteMany({});
  const dbPrep = mongoose.connection.db!;
  for (const col of [MINUTE_COLLECTION, HOUR_COLLECTION, DAY_COLLECTION]) {
    await dbPrep.collection(col).deleteMany({});
  }

  // Seed a matching machines doc so ObjectId-machine readings resolve to 'CMP-001'.
  const objectIdMachine = new mongoose.Types.ObjectId();
  await Machine.create({
    _id: objectIdMachine,
    machineId: 'CMP-001',
    name: 'Main Compressor',
    machineType: 'Compressor',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    criticality: 'high',
    operatingHours: 1000,
    notes: '',
    createdBy: new mongoose.Types.ObjectId(),
  });
  console.log('[phase4] Seeded machines doc: _id=' + objectIdMachine + ' machineId=CMP-001');

  // Insert via the NATIVE collection (not the Mongoose model) so the machine
  // and date fields keep their exact legacy BSON types: the Mongoose model
  // would cast ObjectId -> hex string and Date -> number, silently defeating
  // this test. The native driver preserves the types we are exercising.
  const rawCol = mongoose.connection.db!.collection('sensorreadings');

  // 10 readings: string machine + numeric epoch-ms date
  const numericDateReadings = [];
  for (let i = 0; i < 10; i++) {
    numericDateReadings.push({
      machine: 'CMP-001',
      date: now - i * 60 * 60 * 1000,
      temperature: 70 + Math.random() * 10,
      vibration: 1.0 + Math.random() * 2,
      operatingHours: 1000 + i * 100,
      source: 'test-numeric-date',
      syncedToFirebase: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await rawCol.insertMany(numericDateReadings);

  // 10 readings: ObjectId machine (legacy) + numeric epoch-ms date
  const objectIdDateReadings = [];
  for (let i = 0; i < 10; i++) {
    objectIdDateReadings.push({
      machine: objectIdMachine,
      date: now - i * 60 * 60 * 1000,
      temperature: 70 + Math.random() * 10,
      vibration: 1.0 + Math.random() * 2,
      operatingHours: 1000 + i * 100,
      source: 'test-objectid-machine',
      syncedToFirebase: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await rawCol.insertMany(objectIdDateReadings);

  // 5 readings: string machine + BSON Date (legacy, pre-migration)
  const dateObjReadings = [];
  for (let i = 0; i < 5; i++) {
    dateObjReadings.push({
      machine: 'CMP-001',
      date: new Date(now - i * 60 * 60 * 1000),
      temperature: 70 + Math.random() * 10,
      vibration: 1.0 + Math.random() * 2,
      operatingHours: 1000 + i * 100,
      source: 'test-date-obj',
      syncedToFirebase: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await rawCol.insertMany(dateObjReadings);

  // Sanity: the native insert preserved the legacy types we are testing.
  const typedObjectId = await rawCol.countDocuments({ machine: objectIdMachine, source: 'test-objectid-machine' });
  const stringMachine = await rawCol.countDocuments({ machine: 'CMP-001', source: 'test-numeric-date' });
  const dateObjCount = await rawCol.countDocuments({ machine: 'CMP-001', source: 'test-date-obj', date: { $type: 'date' } });
  console.log('[phase4] typed counts - objectid-machine=' + typedObjectId + ', string-machine=' + stringMachine + ', date-obj=' + dateObjCount);
  expect(typedObjectId).toBe(10);
  expect(stringMachine).toBe(10);
  expect(dateObjCount).toBe(5);

  const totalRaw = await SensorReading.countDocuments({ source: /^test-/ });
  console.log('[phase4] Seeded ' + totalRaw + ' raw readings (numeric-date + objectid-machine + date-obj). Expected 25.');

  // Ensure unique {machine, bucket} indexes exist on rollup collections for $merge.
  const dbSetup = mongoose.connection.db!;
  for (const col of [MINUTE_COLLECTION, HOUR_COLLECTION, DAY_COLLECTION]) {
    await dbSetup.collection(col).createIndex({ machine: 1, bucket: 1 }, { unique: true });
  }
  console.log('[phase4] Unique {machine,bucket} indexes created on rollup collections');

  const endMs = Date.now();
  const startMs = endMs - 24 * 60 * 60 * 1000; // last 24 hours
  await buildRollups(MINUTE_COLLECTION, startMs, endMs);
  await buildRollups(HOUR_COLLECTION, startMs, endMs);
  await buildRollups(DAY_COLLECTION, startMs, endMs);
  console.log('[phase4] Rollup aggregation completed');

  const db = mongoose.connection.db!;
  const minuteDocs = await db.collection(MINUTE_COLLECTION).find({}).toArray();
  const hourDocs = await db.collection(HOUR_COLLECTION).find({}).toArray();
  const dayDocs = await db.collection(DAY_COLLECTION).find({}).toArray();

  console.log('[phase4] Rollup docs - minute=' + minuteDocs.length + ', hour=' + hourDocs.length + ', day=' + dayDocs.length);

  // Every rollup doc must carry the normalized string machine code 'CMP-001',
  // never a raw ObjectId (both source forms must collapse to the same code).
  for (const doc of [...minuteDocs, ...hourDocs, ...dayDocs]) {
    expect(doc.machine).toBe('CMP-001');
    expect(typeof doc.bucket).toBe('number');
    expect(doc.count).toBeGreaterThan(0);
    expect(typeof doc.firstReading).toBe('number');
    expect(typeof doc.lastReading).toBe('number');
  }

  // Assert all three source forms (25 seeded readings) landed in the same buckets.
  const totalMinute = minuteDocs.reduce((sum, d) => sum + d.count, 0);
  const totalHour = hourDocs.reduce((sum, d) => sum + d.count, 0);
  const totalDay = dayDocs.reduce((sum, d) => sum + d.count, 0);
  console.log('[phase4] Sum of count: minute=' + totalMinute + ', hour=' + totalHour + ', day=' + totalDay);
  expect(totalMinute).toBe(25);
  expect(totalHour).toBe(25);
  expect(totalDay).toBe(25);

  // There must be exactly one normalized machine across the minute buckets.
  const distinctMachines = [...new Set(minuteDocs.map((d) => String(d.machine)))];
  console.log('[phase4] Distinct normalized machine values: ' + JSON.stringify(distinctMachines));
  expect(distinctMachines).toEqual(['CMP-001']);

  // Cleanup: remove Phase 4 seed data and the machines doc.
  await SensorReading.deleteMany({ source: /^test-/ });
  await Machine.deleteMany({ _id: objectIdMachine });
  console.log('[phase4] Cleaned up seed data and machines doc');

  console.log('[phase4] PASSED.');
}
// ---------- State flagging + Phase 3: state-machine gating of alerts ---------- //
async function runPhase3(): Promise<void> {
  console.log('\n=== PHASE 3: State-Machine Gating of Alerts ===');

  // Phase 2.5 left a 'starting' state entry; reset so Phase 3 starts clean
  // (no state entry → fail-open default, then we flag 'starting' ourselves).
  await MachineState.deleteMany({ machine: MACHINE });
  await Alert.deleteMany({ machine: MACHINE });

  // Machine has no state entry yet (fail-open default: anomaly detection runs).
  // Flag it 'starting': readings must be stored, anomaly suppressed, no alerts.
  console.log('\n--- Setup: flag machine as starting ---');
  const starting = await postState('starting', 'juan-dev');
  expect(starting.status).toBe(201);
  expect(starting.body.stateLog.state).toBe('starting');
  expect(starting.body.stateLog.changedBy).toBe('juan-dev');
  console.log('[phase3/setup] State log:', JSON.stringify(starting.body.stateLog));

  const dupe = await postState('starting', 'juan-dev');
  expect(dupe.status).toBe(200);
  expect(dupe.body.deduplicated).toBe(true);
  expect(dupe.body.stateLog._id).toBe(starting.body.stateLog._id);
  console.log('[phase3/setup] Repeated flag rejected (deduplicated).');

  const now = Date.now();
  const suspended = await postDeviceReading(120.0, 1.0, now);
  expect(suspended.status).toBe(200);
  expect(suspended.body.machineState).toBe('starting');
  expect(suspended.body.anomaly).toBeNull();
  expect(await Alert.countDocuments({ machine: MACHINE, resolved: false })).toBe(0);
  console.log('[phase3/suspended] reading stored, anomaly=null, alerts=0');

  // ---- Transition to operating: baseline resets, alerts resume ----
  const operating = await postState('operating', 'juan-dev');
  expect(operating.status).toBe(201);
  expect(operating.body.stateLog.state).toBe('operating');
  expect(await getState()).toBeTruthy();
  console.log('[phase3/transition] State log:', JSON.stringify(operating.body.stateLog));

  const first = await postDeviceReading(120.0, 1.0, now + 2000);
  expect(first.status).toBe(200);
  expect(first.body.machineState).toBe('operating');
  expect(first.body.anomaly).toMatchObject({ severity: 'critical', parameter: 'temperature' });
  const countAfterFirst = await Alert.countDocuments({ machine: MACHINE, resolved: false });
  expect(countAfterFirst).toBe(1);
  expect(pushesTo('alerts')).toHaveLength(1);
  console.log(`[phase3/anomaly] alert created, Firebase pushes: ${pushesTo('alerts').length}`);

  await delay(1100);

  // ---- Test 2: duplicate while operating -> suppressed, zero new 'alerts' pushes ----
  const duplicate = await postDeviceReading(140.0, 1.1, now + 3000);
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.machineState).toBe('operating');
  expect(duplicate.body.anomaly).toMatchObject({ severity: 'critical', parameter: 'temperature' });
  expect(await Alert.countDocuments({ machine: MACHINE, resolved: false })).toBe(1);
  expect(pushesTo('alerts')).toHaveLength(1);
  console.log('[phase3/duplicate] suppressed, no new alert, no extra Firebase push');

  await delay(1100);

  // ---- Test 3: concurrent POSTs while operating (partial unique index) ----
  const [resA, resB] = await Promise.all([
    postDeviceReading(150.0, 1.0, now + 4000),
    postDeviceReading(149.0, 1.1, now + 4001),
  ]);
  expect(resA.status).toBe(200);
  expect(resB.status).toBe(200);
  const countConcurrent = await Alert.countDocuments({ machine: MACHINE, resolved: false });
  expect(countConcurrent).toBe(1); // one wins the race; E11000 suppresses the other
  expect(pushesTo('alerts')).toHaveLength(1);
  console.log(`[phase3/concurrent] unresolved alerts=${countConcurrent}, 'alerts' pushes=${pushesTo('alerts').length}`);

  console.log('\n=== PHASE 3 COMPLETE ===');
}

// ---------- Suite wiring ---------- //
describe('Integration: Phases 1-4 (real Express app over HTTP, in-memory Mongo)', () => {
  beforeAll(async () => {
    console.log('=== INTEGRATION TEST: Phases 1-4 ===');
    await setupMongoServer();
    await setupDatabase();
    app = createApp();
    console.log('[setup] App created, database reset.');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('[teardown] In-memory MongoDB stopped.');
    }
  });

  it('Phase 1: migration / numeric epoch-ms date types', async () => {
    await runPhase1();
  });

  it('Phase 2: rollup persistence (minute/hour/day buckets)', async () => {
    await runPhase2();
  });

  it('Phase 2.5: machine-state flagging API (current/history/dedupe)', async () => {
    // Machine starts with no state entry - fail-open default (anomaly runs).
    // Flag it 'starting' then verify the endpoint contract:
    const flag = await postState('starting', 'juan-dev');
    expect(flag.status).toBe(201);
    expect(flag.body.stateLog.state).toBe('starting');
    expect(flag.body.stateLog.changedBy).toBe('juan-dev');

    const dupe = await postState('starting', 'juan-dev');
    expect(dupe.status).toBe(200);
    expect(dupe.body.deduplicated).toBe(true);

    const current = await getState();
    expect(current.body.current?.state).toBe('starting');
    expect(current.body.current?.ageMs).toBeGreaterThan(0);

    const history = await getStateHistory();
    expect(history.body.history).toHaveLength(1);
    expect(history.body.history[0].state).toBe('starting');
  });

  it('Phase 3: state-machine gating of alerts with Firebase assertions', async () => {
    await runPhase3();
  });

  it('Phase 4: Date-typed and ObjectId-machine rollups', async () => {
    await runPhase4();
  });
});

